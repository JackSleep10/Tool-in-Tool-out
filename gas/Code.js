/*
 * GSE Store Management - Backend Script
 * Copy and paste this code into your Google Apps Script project (Code.gs).
 * Deploy as Web App -> Execute as: Me -> Who has access: Anyone
 */

function doGet(e) {
  // If we have an action parameter, treat it as an API call
  if (e.parameter.action) {
     return handleRequest(e);
  }
  // Otherwise, serve the HTML page (Frontend)
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('GSE Store Management')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) // Optional: Allow iframe
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  // Note: Google Apps Script handles CORS automatically for Web Apps

  // Handle Options request (Preflight)
  if (e.parameter && e.parameter.method === "OPTIONS") {
     return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  var result = { status: 'success', data: null };
  
  try {
    // Parse Payload
    var action = e.parameter.action;
    var payload = {};
    if (e.postData && e.postData.contents) {
      var data = JSON.parse(e.postData.contents);
      action = data.action || action;
      payload = data;
    }

    // Router
    switch (action) {
      case 'GET_ALL_DATA':
        result.data = getAllData(payload);
        break;
      case 'GET_FULL_HISTORY':
        result.data = {
          transactions: getSheetData(getSpreadsheet(), 'Transactions'),
          has_full_history: true
        };
        break;
      case 'BORROW':
        result.data = addTransaction(payload, 'BORROW');
        break;
      case 'RETURN':
        result.data = addTransaction(payload, 'RETURN');
        break;
      case 'BATCH_TRANSACTIONS':
        result.data = addBatchTransactions(payload.transactions);
        break;
      case 'MARK_UNSERVICEABLE':
        result.data = markToolServiceability(payload, 'UNSERVICEABLE');
        break;
      case 'MARK_SERVICEABLE':
        result.data = markToolServiceability(payload, 'SERVICEABLE');
        break;
      case 'RUN_TOOL_MIGRATION':
        result.data = runToolMigration();
        break;
      default:
        result.status = 'error';
        result.message = 'Unknown action: ' + action;
    }

  } catch (err) {
    result.status = 'error';
    result.message = err.toString();
  }

  // Return JSON
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Database Helpers ---
// Hardcode Spreadsheet ID
const SHEET_ID = '1I71IPC0Sb-PI9zNIcxsJ4ifVqggHXU3xeE2Of6Q4OXc';

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getAllData(payload) {
  const ss = getSpreadsheet();
  const employees = getSheetData(ss, 'Employees');
  const tools = getSheetData(ss, 'Tools');
  
  if (payload && payload.full_history) {
    return {
      employees: employees,
      tools: tools,
      transactions: getSheetData(ss, 'Transactions'),
      has_full_history: true
    };
  }

  const allTx = getSheetData(ss, 'Transactions');
  
  // Replay FIFO to match returns with borrows
  let outstandingList = [];
  const returnToBorrowMap = {};

  for (let i = 0; i < allTx.length; i++) {
    const tx = allTx[i];
    if (tx.action === 'BORROW') {
      outstandingList.push(tx);
    } else if (tx.action === 'RETURN') {
      const toolId = (tx.tool_id || '').toString();
      const empId = (tx.employee_id || '').toString();
      const idx = outstandingList.findIndex(function(item) {
        return (item.tool_id || '').toString() === toolId && (item.employee_id || '').toString() === empId;
      });
      if (idx !== -1) {
        const matchedBorrow = outstandingList.splice(idx, 1)[0];
        if (tx.id && matchedBorrow.id) {
          returnToBorrowMap[tx.id] = matchedBorrow.id;
        }
      }
    }
  }

  const outstandingIds = {};
  for (let j = 0; j < outstandingList.length; j++) {
    if (outstandingList[j].id) {
      outstandingIds[outstandingList[j].id] = true;
    }
  }

  const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  const linkedBorrowIds = {};
  for (let k = 0; k < allTx.length; k++) {
    const item = allTx[k];
    if (item.action === 'RETURN' && item.date) {
      const t = new Date(item.date).getTime();
      if (!isNaN(t) && t >= cutoffTime) {
        const borrowId = returnToBorrowMap[item.id];
        if (borrowId) {
          linkedBorrowIds[borrowId] = true;
        }
      }
    }
  }

  const filteredTx = [];
  for (let m = 0; m < allTx.length; m++) {
    const tx = allTx[m];
    const isOutstanding = tx.id && outstandingIds[tx.id];
    const isLinkedBorrow = tx.id && linkedBorrowIds[tx.id];
    let isRecent = false;
    if (tx.date) {
      const txTime = new Date(tx.date).getTime();
      if (!isNaN(txTime) && txTime >= cutoffTime) {
        isRecent = true;
      }
    }
    if (isOutstanding || isLinkedBorrow || isRecent) {
      filteredTx.push(tx);
    }
  }

  return {
    employees: employees,
    tools: tools,
    transactions: filteredTx,
    total_transactions_count: allTx.length,
    has_full_history: false
  };
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h.toLowerCase()] = row[i];
    });
    return obj;
  });
}

function addTransaction(data, type) {
  const ss = getSpreadsheet();
  
  if (type === 'BORROW') {
    const toolsSheet = ss.getSheetByName('Tools');
    if (toolsSheet) {
      const toolsData = toolsSheet.getDataRange().getValues();
      const tHeaders = toolsData[0].map(h => h.toString().toLowerCase().trim());
      const idCol = tHeaders.indexOf('id');
      const statCol = tHeaders.indexOf('serviceability_status');
      if (idCol !== -1 && statCol !== -1) {
        const targetId = (data.tool_id || '').toString().toLowerCase().trim();
        for (let i = 1; i < toolsData.length; i++) {
          if ((toolsData[i][idCol] || '').toString().toLowerCase().trim() === targetId) {
            if ((toolsData[i][statCol] || '').toString().toUpperCase().trim() === 'UNSERVICEABLE') {
              return { status: 'error', message: 'อุปกรณ์ "' + (data.tool_name || data.tool_id) + '" อยู่ในสถานะชำรุด (U/S) ไม่สามารถเบิกได้' };
            }
            break;
          }
        }
      }
    }
  }

  const sheet = ss.getSheetByName('Transactions');
  
  const newRow = [
    Utilities.getUuid(), // id
    new Date(),          // date
    type,                // action
    data.tool_id,
    data.tool_name,
    data.employee_id,
    data.employee_name,
    data.quantity || 1,
    data.staff_issuer || '-',
    data.staff_receiver || '-',
    data.linked_borrow_id || '-',
    data.remark || '-'
  ];
  
  sheet.appendRow(newRow);
  return { status: 'recorded', id: newRow[0] };
}

function addBatchTransactions(transactions) {
  if (!transactions || !transactions.length) return { status: 'error', message: 'No transactions' };
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  const results = [];
  const rows = [];
  
  // Guard: Check if any BORROW item is UNSERVICEABLE
  const toolsSheet = ss.getSheetByName('Tools');
  if (toolsSheet) {
    const toolsData = toolsSheet.getDataRange().getValues();
    const tHeaders = toolsData[0].map(h => h.toString().toLowerCase().trim());
    const idCol = tHeaders.indexOf('id');
    const statCol = tHeaders.indexOf('serviceability_status');
    if (idCol !== -1 && statCol !== -1) {
      const usMap = {};
      for (let i = 1; i < toolsData.length; i++) {
        const tid = (toolsData[i][idCol] || '').toString().toLowerCase().trim();
        const stat = (toolsData[i][statCol] || '').toString().toUpperCase().trim();
        if (stat === 'UNSERVICEABLE') usMap[tid] = true;
      }
      for (let j = 0; j < transactions.length; j++) {
        const t = transactions[j];
        if (t.action === 'BORROW' && usMap[(t.tool_id || '').toString().toLowerCase().trim()]) {
          return { status: 'error', message: 'อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" อยู่ในสถานะชำรุด (U/S) ไม่สามารถเบิกได้' };
        }
      }
    }
  }
  
  transactions.forEach((data) => {
    const uuid = Utilities.getUuid();
    const newRow = [
      uuid,                // id
      new Date(),          // date
      data.action,         // action
      data.tool_id,
      data.tool_name,
      data.employee_id,
      data.employee_name,
      data.quantity || 1,
      data.staff_issuer || '-',
      data.staff_receiver || '-',
      data.linked_borrow_id || '-',
      data.remark || '-'
    ];
    rows.push(newRow);
    results.push(uuid);
  });
  
  // Append all rows at once using getRange & setValues
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  
  return { status: 'batch_recorded', count: transactions.length, ids: results };
}

function markToolServiceability(data, status, _retry) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Tools');
  if (!sheet) return { status: 'error', message: 'Tools sheet not found' };

  if (!data.tool_id) return { status: 'error', message: 'tool_id is required' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => h.toString().toLowerCase());

  // Find column indices
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('serviceability_status');
  const reasonCol = headers.indexOf('unserviceable_reason');
  const dateCol = headers.indexOf('unserviceable_date');
  const byCol = headers.indexOf('unserviceable_by');

  if (idCol === -1) return { status: 'error', message: 'ID column not found' };

  // If serviceability columns don't exist yet, add them
  if (statusCol === -1) {
    if (_retry) return { status: 'error', message: 'Failed to create serviceability columns' };
    const lastCol = headers.length;
    sheet.getRange(1, lastCol + 1, 1, 4).setValues([['serviceability_status', 'unserviceable_reason', 'unserviceable_date', 'unserviceable_by']]);
    // Re-read headers after adding columns
    return markToolServiceability(data, status, true);
  }

  // Ensure all serviceability columns exist
  if (reasonCol === -1 || dateCol === -1 || byCol === -1) {
    return { status: 'error', message: 'Missing serviceability columns in Tools sheet' };
  }

  // Find the tool row
  const toolId = (data.tool_id || '').toString().toLowerCase();
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol].toString().toLowerCase() === toolId) {
      rowIndex = i + 1; // 1-indexed for sheet
      break;
    }
  }

  if (rowIndex === -1) return { status: 'error', message: 'Tool not found: ' + data.tool_id };

  const values = status === 'UNSERVICEABLE'
    ? ['UNSERVICEABLE', data.reason || '', new Date(), data.marked_by || '']
    : ['SERVICEABLE', '', '', ''];
  sheet.getRange(rowIndex, statusCol + 1, 1, 4).setValues([values]);

  return { status: 'updated', tool_id: data.tool_id };
}
