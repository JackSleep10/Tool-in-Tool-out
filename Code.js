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

// Actions that modify the spreadsheet. These run under a script lock so that
// concurrent requests can never write to the same row or double-borrow a tool.
const WRITE_ACTIONS = ['BORROW', 'RETURN', 'BATCH_TRANSACTIONS', 'MARK_UNSERVICEABLE', 'MARK_SERVICEABLE'];
const LOCK_TIMEOUT_MS = 20000;

function handleRequest(e) {
  // Note: Google Apps Script handles CORS automatically for Web Apps

  // Handle Options request (Preflight)
  if (e.parameter && e.parameter.method === "OPTIONS") {
     return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  var result = { status: 'success', data: null };
  var lock = null;

  try {
    // Parse Payload
    var action = e.parameter.action;
    var payload = {};
    if (e.postData && e.postData.contents) {
      var data = JSON.parse(e.postData.contents);
      action = data.action || action;
      payload = data;
    }

    if (WRITE_ACTIONS.indexOf(action) !== -1) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
        throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
      }
    }

    // Router
    // NOTE: RUN_TOOL_MIGRATION was intentionally removed from the public API.
    // runToolMigration() clears the Tools sheet, so it must only be run
    // manually from the Apps Script editor.
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
      default:
        result.status = 'error';
        result.message = 'Unknown action: ' + action;
    }

    if (lock) SpreadsheetApp.flush();

  } catch (err) {
    result.status = 'error';
    result.data = null;
    result.message = (err && err.message) ? err.message : String(err);
  } finally {
    if (lock) lock.releaseLock();
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

// Normalize IDs so that 'TLR-001', ' tlr-001 ' and numeric IDs compare consistently.
function normalizeId(value) {
  return (value === null || value === undefined ? '' : value).toString().trim().toLowerCase();
}

// Prevent spreadsheet formula injection (values starting with = + @ or - followed
// by text are interpreted as formulas by Google Sheets; plain '-' is kept as-is).
function sanitizeCell(value) {
  if (typeof value === 'string' && /^(?:[=+@]|-(?!$))/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Replay transactions chronologically and return the list of BORROW records
 * that have not been returned yet, plus a map of RETURN id -> matched BORROW id.
 * Matches by linked_borrow_id first, then falls back to FIFO by (tool_id, employee_id).
 */
function computeOutstanding(allTx) {
  if (!allTx || allTx.length === 0) {
    return { outstandingList: [], returnToBorrowMap: {} };
  }

  const sorted = allTx.slice().sort(function(a, b) {
    const ta = new Date(a && a.date).getTime();
    const tb = new Date(b && b.date).getTime();
    const na = isNaN(ta) ? 0 : ta;
    const nb = isNaN(tb) ? 0 : tb;
    return na - nb;
  });

  const outstandingList = [];
  const returnToBorrowMap = {};

  for (let i = 0; i < sorted.length; i++) {
    const tx = sorted[i];
    if (!tx) continue;

    if (tx.action === 'BORROW') {
      outstandingList.push(tx);
    } else if (tx.action === 'RETURN') {
      const linkedId = normalizeId(tx.linked_borrow_id);
      let idx = -1;

      if (linkedId && linkedId !== '-') {
        idx = outstandingList.findIndex(function(item) {
          const itemId = normalizeId(item.id);
          return itemId !== '' && itemId === linkedId;
        });
      }

      if (idx === -1) {
        const toolId = normalizeId(tx.tool_id);
        const empId = normalizeId(tx.employee_id);
        idx = outstandingList.findIndex(function(item) {
          return normalizeId(item.tool_id) === toolId && normalizeId(item.employee_id) === empId;
        });
      }

      if (idx !== -1) {
        const matchedBorrow = outstandingList.splice(idx, 1)[0];
        if (tx.id && matchedBorrow.id) {
          returnToBorrowMap[tx.id] = matchedBorrow.id;
        }
      }
    }
  }

  return { outstandingList: outstandingList, returnToBorrowMap: returnToBorrowMap };
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
  
  // Replay FIFO / linked_borrow_id to match returns with borrows
  const replay = computeOutstanding(allTx);
  const outstandingList = replay.outstandingList;
  const returnToBorrowMap = replay.returnToBorrowMap;

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
  if (!data || data.length === 0) return [];
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      const key = (h === null || h === undefined ? '' : h).toString().trim().toLowerCase();
      if (key) obj[key] = row[i];
    });
    return obj;
  });
}

function addTransaction(data, type) {
  // Single transactions go through the same validated batch path.
  const tx = Object.assign({}, data, { action: type });
  const res = addBatchTransactions([tx]);
  return { status: 'recorded', id: res.ids[0] };
}

function addBatchTransactions(transactions) {
  if (!transactions || !transactions.length) throw new Error('No transactions');
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  if (!sheet) throw new Error('Transactions sheet not found');
  const results = [];
  const rows = [];

  // Basic validation
  for (let v = 0; v < transactions.length; v++) {
    const t = transactions[v];
    if (t.action !== 'BORROW' && t.action !== 'RETURN') {
      throw new Error('Invalid action: ' + t.action);
    }
    if (!normalizeId(t.tool_id)) throw new Error('tool_id is required');
    if (!normalizeId(t.employee_id)) throw new Error('employee_id is required');
  }
  
  // Guard: Check if any BORROW item is UNSERVICEABLE
  const toolsSheet = ss.getSheetByName('Tools');
  if (toolsSheet) {
    const toolsData = toolsSheet.getDataRange().getValues();
    if (toolsData.length > 0) {
      const tHeaders = toolsData[0].map(h => (h === null || h === undefined ? '' : h).toString().trim().toLowerCase());
      const idCol = tHeaders.indexOf('id');
      const statCol = tHeaders.indexOf('serviceability_status');
      if (idCol !== -1 && statCol !== -1) {
        const usMap = {};
        for (let i = 1; i < toolsData.length; i++) {
          const tid = normalizeId(toolsData[i][idCol]);
          const stat = (toolsData[i][statCol] || '').toString().toUpperCase().trim();
          if (stat === 'UNSERVICEABLE') usMap[tid] = true;
        }
        for (let j = 0; j < transactions.length; j++) {
          const t = transactions[j];
          if (t.action === 'BORROW' && usMap[normalizeId(t.tool_id)]) {
            throw new Error('อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" อยู่ในสถานะชำรุด (U/S) ไม่สามารถเบิกได้');
          }
        }
      }
    }
  }

  // Guard: a tool that is still borrowed cannot be borrowed again.
  // Runs under the script lock (see handleRequest), so this check is race-free.
  const hasBorrow = transactions.some(t => t.action === 'BORROW');
  if (hasBorrow) {
    const replay = computeOutstanding(getSheetData(ss, 'Transactions'));
    const outByTool = {};
    replay.outstandingList.forEach(function(b) {
      outByTool[normalizeId(b.tool_id)] = b;
    });
    // Apply this batch in order so RETURN-then-BORROW in one batch is allowed.
    for (let k = 0; k < transactions.length; k++) {
      const t = transactions[k];
      const key = normalizeId(t.tool_id);
      if (t.action === 'RETURN') {
        delete outByTool[key];
      } else {
        const existing = outByTool[key];
        if (existing) {
          throw new Error('อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" ถูกยืมอยู่แล้วโดย ' +
            (existing.employee_name || '') + ' (' + (existing.employee_id || '') + ')');
        }
        outByTool[key] = t;
      }
    }
  }
  
  transactions.forEach((data) => {
    const uuid = Utilities.getUuid();
    const newRow = [
      uuid,                // id
      new Date(),          // date
      data.action,         // action
      sanitizeCell(data.tool_id),
      sanitizeCell(data.tool_name),
      sanitizeCell(data.employee_id),
      sanitizeCell(data.employee_name),
      data.quantity || 1,
      sanitizeCell(data.staff_issuer || '-'),
      sanitizeCell(data.staff_receiver || '-'),
      sanitizeCell(data.linked_borrow_id || '-'),
      sanitizeCell(data.remark || '-')
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
  if (!sheet) throw new Error('Tools sheet not found');

  if (!data.tool_id) throw new Error('tool_id is required');

  const allData = sheet.getDataRange().getValues();
  if (!allData || allData.length === 0) throw new Error('Tools sheet is empty');
  const headers = allData[0].map(h => (h === null || h === undefined ? '' : h).toString().trim().toLowerCase());

  // Find column indices
  const idCol = headers.indexOf('id');
  const statusCol = headers.indexOf('serviceability_status');
  const reasonCol = headers.indexOf('unserviceable_reason');
  const dateCol = headers.indexOf('unserviceable_date');
  const byCol = headers.indexOf('unserviceable_by');

  if (idCol === -1) throw new Error('ID column not found');

  // If serviceability columns don't exist yet, add them
  if (statusCol === -1) {
    if (_retry) throw new Error('Failed to create serviceability columns');
    const lastCol = headers.length;
    sheet.getRange(1, lastCol + 1, 1, 4).setValues([['serviceability_status', 'unserviceable_reason', 'unserviceable_date', 'unserviceable_by']]);
    // Re-read headers after adding columns
    return markToolServiceability(data, status, true);
  }

  // Ensure all serviceability columns exist
  if (reasonCol === -1 || dateCol === -1 || byCol === -1) {
    throw new Error('Missing serviceability columns in Tools sheet');
  }

  // Find the tool row
  const toolId = normalizeId(data.tool_id);
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (normalizeId(allData[i][idCol]) === toolId) {
      rowIndex = i + 1; // 1-indexed for sheet
      break;
    }
  }

  if (rowIndex === -1) throw new Error('Tool not found: ' + data.tool_id);

  const values = status === 'UNSERVICEABLE'
    ? ['UNSERVICEABLE', sanitizeCell(data.reason || ''), new Date(), sanitizeCell(data.marked_by || '')]
    : ['SERVICEABLE', '', '', ''];
  sheet.getRange(rowIndex, statusCol + 1, 1, 4).setValues([values]);

  return { status: 'updated', tool_id: data.tool_id };
}
