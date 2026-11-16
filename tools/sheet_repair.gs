/**
 * Manual Google Sheet Inspection & Repair Utilities (Run ONLY from Apps Script Editor)
 * -------------------------------------------------------------------------------
 * Not wired to doGet/doPost so web users can never invoke these functions.
 * Always make a copy of your Google Sheet (File -> Make a copy) before running
 * any repair with dryRun = false!
 */

const REPAIR_SHEET_ID = '1I71IPC0Sb-PI9zNIcxsJ4ifVqggHXU3xeE2Of6Q4OXc';

/**
 * 2.1 (H1): Check whether the Employees sheet has id/name columns or values swapped,
 * and check Transactions rows where employee_id/employee_name look swapped.
 * Run dry-run first via menu/editor: inspectAndRepairEmployees(true)
 */
function inspectEmployeesAndTransactions() {
  return repairSwappedEmployees(true);
}

function repairSwappedEmployees(dryRun) {
  if (dryRun === undefined) dryRun = true;
  var ss = SpreadsheetApp.openById(REPAIR_SHEET_ID);
  var empSheet = ss.getSheetByName('Employees');
  var txSheet = ss.getSheetByName('Transactions');
  if (!empSheet || !txSheet) throw new Error('Employees or Transactions sheet not found');

  var empValues = empSheet.getDataRange().getValues();
  var empHeaders = empValues[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var empIdCol = empHeaders.indexOf('id');
  var empNameCol = empHeaders.indexOf('name');

  var swappedEmpRows = [];
  for (var i = 1; i < empValues.length; i++) {
    var rawId = String(empValues[i][empIdCol] || '').trim();
    var rawName = String(empValues[i][empNameCol] || '').trim();
    // Heuristic: employee ID is digits/short code while name has spaces or Thai letters
    var idLooksLikeName = /[ก-๙\s]{2,}/.test(rawId) && !/^\d+$/.test(rawId);
    var nameLooksLikeId = /^[A-Z0-9-]{3,12}$/i.test(rawName) && /\d/.test(rawName);
    if (idLooksLikeName && nameLooksLikeId) {
      swappedEmpRows.push({ row: i + 1, currentId: rawId, currentName: rawName });
      if (!dryRun) {
        empSheet.getRange(i + 1, empIdCol + 1).setValue(rawName);
        empSheet.getRange(i + 1, empNameCol + 1).setValue(rawId);
      }
    }
  }

  var txValues = txSheet.getDataRange().getValues();
  var txHeaders = txValues[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var txEmpIdCol = txHeaders.indexOf('employee_id');
  var txEmpNameCol = txHeaders.indexOf('employee_name');

  var swappedTxRows = [];
  if (txEmpIdCol !== -1 && txEmpNameCol !== -1) {
    for (var j = 1; j < txValues.length; j++) {
      var txEmpId = String(txValues[j][txEmpIdCol] || '').trim();
      var txEmpName = String(txValues[j][txEmpNameCol] || '').trim();
      var txIdLooksLikeName = /[ก-๙\s]{2,}/.test(txEmpId) && !/^\d+$/.test(txEmpId);
      var txNameLooksLikeId = /^[A-Z0-9-]{3,12}$/i.test(txEmpName) && /\d/.test(txEmpName);
      if (txIdLooksLikeName && txNameLooksLikeId) {
        swappedTxRows.push({ row: j + 1, currentEmpId: txEmpId, currentEmpName: txEmpName });
        if (!dryRun) {
          txSheet.getRange(j + 1, txEmpIdCol + 1).setValue(txEmpName);
          txSheet.getRange(j + 1, txEmpNameCol + 1).setValue(txEmpId);
        }
      }
    }
  }

  var summary = {
    dryRun: dryRun,
    empHeaders: empValues[0],
    swappedEmployeeRowsCount: swappedEmpRows.length,
    swappedTransactionRowsCount: swappedTxRows.length,
    sampleSwappedEmployees: swappedEmpRows.slice(0, 10),
    sampleSwappedTransactions: swappedTxRows.slice(0, 10)
  };
  Logger.log(JSON.stringify(summary, null, 2));
  return summary;
}

/**
 * 2.10 (M6): Report Transactions with tool_id missing from Tools sheet
 * and any Tools rows missing an ID. Read-only diagnostic report.
 */
function reportOrphanToolIds() {
  var ss = SpreadsheetApp.openById(REPAIR_SHEET_ID);
  var toolValues = ss.getSheetByName('Tools').getDataRange().getValues();
  var txValues = ss.getSheetByName('Transactions').getDataRange().getValues();

  var tHeaders = toolValues[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var tIdCol = tHeaders.indexOf('id');
  var tNameCol = tHeaders.indexOf('name');

  var validToolIds = {};
  var blankToolIdRows = [];
  for (var i = 1; i < toolValues.length; i++) {
    var tid = String(toolValues[i][tIdCol] || '').trim().toLowerCase();
    if (!tid) {
      blankToolIdRows.push({ row: i + 1, name: toolValues[i][tNameCol] || '' });
    } else {
      validToolIds[tid] = true;
    }
  }

  var txHeaders = txValues[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
  var txToolIdCol = txHeaders.indexOf('tool_id');
  var txToolNameCol = txHeaders.indexOf('tool_name');
  var txDateCol = txHeaders.indexOf('date');

  var orphanTransactions = [];
  for (var j = 1; j < txValues.length; j++) {
    var txTid = String(txValues[j][txToolIdCol] || '').trim().toLowerCase();
    if (!txTid || !validToolIds[txTid]) {
      orphanTransactions.push({
        row: j + 1,
        date: txValues[j][txDateCol],
        tool_id: txValues[j][txToolIdCol],
        tool_name: txValues[j][txToolNameCol]
      });
    }
  }

  var report = {
    totalTools: toolValues.length - 1,
    blankToolIdCount: blankToolIdRows.length,
    blankToolIdRows: blankToolIdRows,
    totalTransactions: txValues.length - 1,
    orphanTransactionsCount: orphanTransactions.length,
    sampleOrphanTransactions: orphanTransactions.slice(0, 25)
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
