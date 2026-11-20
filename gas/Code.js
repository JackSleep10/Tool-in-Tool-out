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

function processRequest(action, payload) {
  var result = { status: 'success', data: null };
  var lock = null;
  var reqPayload = payload || {};

  try {
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
        result.data = getAllData(reqPayload);
        break;
      case 'GET_FULL_HISTORY':
        result.data = getFullHistoryData();
        break;
      case 'BORROW':
        result.data = addTransaction(reqPayload, 'BORROW');
        break;
      case 'RETURN':
        result.data = addTransaction(reqPayload, 'RETURN');
        break;
      case 'BATCH_TRANSACTIONS':
        result.data = addBatchTransactions(reqPayload.transactions);
        break;
      case 'MARK_UNSERVICEABLE':
        result.data = markToolServiceability(reqPayload, 'UNSERVICEABLE');
        break;
      case 'MARK_SERVICEABLE':
        result.data = markToolServiceability(reqPayload, 'SERVICEABLE');
        break;
      default:
        result.status = 'error';
        result.message = 'Unknown action: ' + action;
    }

    if (lock && result.status === 'success') {
      try {
        SpreadsheetApp.flush();
      } catch (flushErr) {
        clearOutstandingStateCache();
        throw flushErr;
      }
      if (action === 'MARK_UNSERVICEABLE' || action === 'MARK_SERVICEABLE') {
        invalidateToolsCache();
      }
      invalidateDataCache();
    }

  } catch (err) {
    result.status = 'error';
    result.data = null;
    result.message = (err && err.message) ? err.message : String(err);
  } finally {
    if (lock) lock.releaseLock();
  }

  return result;
}

function handleRequest(e) {
  // Note: Google Apps Script handles CORS automatically for Web Apps

  // Handle Options request (Preflight)
  if (e && e.parameter && e.parameter.method === "OPTIONS") {
     return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  var result;
  try {
    // Parse Payload
    var action = (e && e.parameter) ? e.parameter.action : '';
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      var data = JSON.parse(e.postData.contents);
      action = data.action || action;
      payload = data;
    }

    result = processRequest(action, payload);
  } catch (err) {
    result = {
      status: 'error',
      data: null,
      message: (err && err.message) ? err.message : String(err)
    };
  }

  // Return JSON
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Direct RPC entry point for google.script.run (avoids HTTP POST -> 302 redirect overhead).
// Returns a JSON string to preserve ISO date formatting and match doPost response schema.
function apiRequest(action, payload) {
  return JSON.stringify(processRequest(action, payload || {}));
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
 * Find the matching outstanding BORROW index for a RETURN transaction.
 * Matches by linked_borrow_id first, then falls back to FIFO by (tool_id, employee_id).
 */
function findBorrowMatchIndex(outstandingList, tx) {
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

  return idx;
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
      const idx = findBorrowMatchIndex(outstandingList, tx);

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

// --- Cache Helpers (M1 & O(1) Guard Caches) ---
const DATA_CACHE_TTL_SEC = 60;
const GUARD_CACHE_TTL_SEC = 300;
const CACHE_CHUNK_CHARS = 30000; // <= 90 KB even when all characters are 3-byte Thai UTF-8
const CACHE_MAX_CHUNKS = 200;
const CACHE_VERSION_PROP = 'DATA_CACHE_VER';
const TOOLS_CACHE_VER_PROP = 'TOOLS_CACHE_VER';
const OUTSTANDING_STATE_KEY = 'outstanding_state_v1';

function getVersionedProp(propName) {
  try {
    if (typeof PropertiesService === 'undefined') return '1';
    var props = PropertiesService.getScriptProperties();
    var ver = props.getProperty(propName);
    if (!ver) {
      ver = String(Date.now());
      props.setProperty(propName, ver);
    }
    return ver;
  } catch (e) {
    return '1';
  }
}

function bumpVersionedProp(propName) {
  try {
    if (typeof PropertiesService === 'undefined') return;
    var nextVer = Date.now() + '_' + Math.floor(Math.random() * 100000);
    PropertiesService.getScriptProperties().setProperty(propName, nextVer);
  } catch (e) {
    // Non-fatal: cache expires by TTL
  }
}

function getCacheVersion() {
  return getVersionedProp(CACHE_VERSION_PROP);
}

function invalidateDataCache() {
  bumpVersionedProp(CACHE_VERSION_PROP);
}

function getToolsCacheVersion() {
  return getVersionedProp(TOOLS_CACHE_VER_PROP);
}

function invalidateToolsCache() {
  bumpVersionedProp(TOOLS_CACHE_VER_PROP);
}

function buildUnserviceableMapFromToolsList(tools) {
  var usMap = {};
  if (!tools || !tools.length) return usMap;
  for (var i = 0; i < tools.length; i++) {
    var t = tools[i];
    if (!t) continue;
    var tid = normalizeId(t.id);
    var stat = (t.serviceability_status || '').toString().toUpperCase().trim();
    if (tid && stat === 'UNSERVICEABLE') {
      usMap[tid] = true;
    }
  }
  return usMap;
}

function saveUnserviceableMapCache(usMap, ver) {
  try {
    if (typeof CacheService === 'undefined') return;
    var cacheVer = ver || getToolsCacheVersion();
    CacheService.getScriptCache().put('us_map_v' + cacheVer, JSON.stringify(usMap || {}), GUARD_CACHE_TTL_SEC);
  } catch (e) {
    // Non-fatal: next request rebuilds from Tools sheet
  }
}

function getUnserviceableMap(ss) {
  var ver = getToolsCacheVersion();
  var cacheKey = 'us_map_v' + ver;
  try {
    if (typeof CacheService !== 'undefined') {
      var cachedStr = CacheService.getScriptCache().get(cacheKey);
      if (cachedStr) {
        var parsed = JSON.parse(cachedStr);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch (e) {
    // Fall through to sheet read
  }

  var usMap = {};
  var toolsSheet = ss.getSheetByName('Tools');
  if (toolsSheet) {
    var toolsData = toolsSheet.getDataRange().getValues();
    if (toolsData.length > 0) {
      var tHeaders = toolsData[0].map(function(h) {
        return (h === null || h === undefined ? '' : h).toString().trim().toLowerCase();
      });
      var idCol = tHeaders.indexOf('id');
      var statCol = tHeaders.indexOf('serviceability_status');
      if (idCol !== -1 && statCol !== -1) {
        for (var i = 1; i < toolsData.length; i++) {
          var tid = normalizeId(toolsData[i][idCol]);
          var stat = (toolsData[i][statCol] || '').toString().toUpperCase().trim();
          if (tid && stat === 'UNSERVICEABLE') {
            usMap[tid] = true;
          }
        }
      }
    }
  }
  saveUnserviceableMapCache(usMap, ver);
  return usMap;
}

function toMinimalOutstandingItem(tx) {
  var d = '';
  if (tx && tx.date) {
    d = tx.date instanceof Date ? tx.date.toISOString() : String(tx.date);
  }
  return {
    id: tx && tx.id !== undefined && tx.id !== null ? String(tx.id) : '',
    date: d,
    action: 'BORROW',
    tool_id: tx && tx.tool_id !== undefined && tx.tool_id !== null ? tx.tool_id : '',
    tool_name: tx && tx.tool_name !== undefined && tx.tool_name !== null ? tx.tool_name : '',
    employee_id: tx && tx.employee_id !== undefined && tx.employee_id !== null ? tx.employee_id : '',
    employee_name: tx && tx.employee_name !== undefined && tx.employee_name !== null ? tx.employee_name : ''
  };
}

function readTransactionsWatermark(txSheet) {
  var lastRow = txSheet.getLastRow();
  var lastRowId = '';
  if (lastRow > 1) {
    var val = txSheet.getRange(lastRow, 1).getValue();
    lastRowId = (val === null || val === undefined ? '' : val).toString().trim();
  }
  return { lastRow: lastRow, lastRowId: lastRowId };
}

function clearOutstandingStateCache() {
  try {
    if (typeof CacheService === 'undefined') return;
    var cache = CacheService.getScriptCache();
    if (typeof cache.remove === 'function') {
      cache.remove(OUTSTANDING_STATE_KEY);
    }
  } catch (e) {
    // Non-fatal
  }
}

function getCachedOutstandingState(watermark) {
  try {
    if (typeof CacheService === 'undefined') return null;
    var raw = CacheService.getScriptCache().get(OUTSTANDING_STATE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.lastRow !== 'number' ||
      parsed.lastRow !== watermark.lastRow ||
      String(parsed.lastRowId || '') !== String(watermark.lastRowId || '') ||
      !Array.isArray(parsed.outstandingList)
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

function saveOutstandingState(lastRow, lastRowId, outstandingList) {
  try {
    if (typeof CacheService === 'undefined') return false;
    var minimal = [];
    for (var i = 0; i < outstandingList.length; i++) {
      minimal.push(toMinimalOutstandingItem(outstandingList[i]));
    }
    var payload = JSON.stringify({
      lastRow: lastRow,
      lastRowId: (lastRowId === null || lastRowId === undefined ? '' : lastRowId).toString().trim(),
      outstandingList: minimal
    });
    CacheService.getScriptCache().put(OUTSTANDING_STATE_KEY, payload, GUARD_CACHE_TTL_SEC);
    return true;
  } catch (e) {
    clearOutstandingStateCache();
    return false;
  }
}

/**
 * Validate and apply a batch of transactions onto an outstanding BORROW list.
 * Allows RETURN-then-BORROW in one batch while blocking duplicate borrows.
 */
function applyTransactionsToOutstanding(baseOutstandingList, txBatch) {
  var list = (baseOutstandingList || []).slice();
  for (var k = 0; k < txBatch.length; k++) {
    var t = txBatch[k];
    if (!t) continue;
    if (t.action === 'RETURN') {
      var idx = findBorrowMatchIndex(list, t);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
    } else if (t.action === 'BORROW') {
      var key = normalizeId(t.tool_id);
      var existing = null;
      for (var m = 0; m < list.length; m++) {
        if (normalizeId(list[m].tool_id) === key) {
          existing = list[m];
          break;
        }
      }
      if (existing) {
        throw new Error('อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" ถูกยืมอยู่แล้วโดย ' +
          (existing.employee_name || '') + ' (' + (existing.employee_id || '') + ')');
      }
      list.push(toMinimalOutstandingItem(t));
    }
  }
  return list;
}

function getChunkedCache(baseKey) {
  try {
    if (typeof CacheService === 'undefined') return null;
    var cache = CacheService.getScriptCache();
    var ver = getCacheVersion();
    var prefix = baseKey + '_v' + ver;
    var metaStr = cache.get(prefix + '_meta');
    if (!metaStr) return null;

    var meta = JSON.parse(metaStr);
    if (!meta || !meta.chunks || meta.chunks <= 0 || meta.chunks > CACHE_MAX_CHUNKS) return null;

    var keys = [];
    for (var i = 0; i < meta.chunks; i++) {
      keys.push(prefix + '_c' + i);
    }

    var valuesByKey = {};
    if (typeof cache.getAll === 'function') {
      for (var g = 0; g < keys.length; g += 25) {
        var batchKeys = keys.slice(g, g + 25);
        var batchRes = cache.getAll(batchKeys);
        if (batchRes) {
          for (var bk in batchRes) {
            if (Object.prototype.hasOwnProperty.call(batchRes, bk)) {
              valuesByKey[bk] = batchRes[bk];
            }
          }
        }
      }
    }
    var parts = [];
    for (var j = 0; j < keys.length; j++) {
      var part = typeof cache.getAll === 'function' ? valuesByKey[keys[j]] : cache.get(keys[j]);
      if (part === null || part === undefined) return null;
      parts.push(part);
    }
    return JSON.parse(parts.join(''));
  } catch (e) {
    return null;
  }
}

function putChunkedCache(baseKey, value) {
  try {
    if (typeof CacheService === 'undefined') return false;
    var cache = CacheService.getScriptCache();
    var json = JSON.stringify(value);
    var totalChunks = Math.ceil(json.length / CACHE_CHUNK_CHARS);
    if (totalChunks <= 0 || totalChunks > CACHE_MAX_CHUNKS) return false;

    var ver = getCacheVersion();
    var prefix = baseKey + '_v' + ver;
    var allKeys = [];
    var entries = {};
    for (var i = 0; i < totalChunks; i++) {
      var chunkKey = prefix + '_c' + i;
      entries[chunkKey] = json.slice(i * CACHE_CHUNK_CHARS, (i + 1) * CACHE_CHUNK_CHARS);
      allKeys.push(chunkKey);
    }
    var metaKey = prefix + '_meta';
    entries[metaKey] = JSON.stringify({ chunks: totalChunks });
    allKeys.push(metaKey);

    if (typeof cache.putAll === 'function') {
      for (var p = 0; p < allKeys.length; p += 25) {
        var batch = {};
        var end = Math.min(p + 25, allKeys.length);
        for (var idx = p; idx < end; idx++) {
          var k = allKeys[idx];
          batch[k] = entries[k];
        }
        cache.putAll(batch, DATA_CACHE_TTL_SEC);
      }
    } else {
      allKeys.forEach(function(k) {
        cache.put(k, entries[k], DATA_CACHE_TTL_SEC);
      });
    }
    return true;
  } catch (e) {
    return false;
  }
}

function getFullHistoryData() {
  var cached = getChunkedCache('full_history');
  if (cached) return cached;

  var verBefore = getCacheVersion();
  var ss = getSpreadsheet();
  var result = {
    transactions: getSheetData(ss, 'Transactions'),
    has_full_history: true
  };
  if (getCacheVersion() === verBefore) {
    putChunkedCache('full_history', result);
  }
  return result;
}

function getAllData(payload) {
  var wantFull = !!(payload && payload.full_history);
  var cacheKey = wantFull ? 'all_data_full' : 'all_data_recent';
  var cached = getChunkedCache(cacheKey);
  if (cached) return cached;

  var verBefore = getCacheVersion();
  var toolsVerBefore = getToolsCacheVersion();
  const ss = getSpreadsheet();
  const employees = getSheetData(ss, 'Employees');
  const tools = getSheetData(ss, 'Tools');

  if (getToolsCacheVersion() === toolsVerBefore) {
    saveUnserviceableMapCache(buildUnserviceableMapFromToolsList(tools), toolsVerBefore);
  }

  if (wantFull) {
    const fullResult = {
      employees: employees,
      tools: tools,
      transactions: getSheetData(ss, 'Transactions'),
      has_full_history: true
    };
    if (getCacheVersion() === verBefore) {
      putChunkedCache(cacheKey, fullResult);
    }
    return fullResult;
  }

  const txSheet = ss.getSheetByName('Transactions');
  const allTx = getSheetData(ss, 'Transactions');

  // Replay FIFO / linked_borrow_id to match returns with borrows
  const replay = computeOutstanding(allTx);
  const outstandingList = replay.outstandingList;
  const returnToBorrowMap = replay.returnToBorrowMap;

  if (getCacheVersion() === verBefore && txSheet) {
    var lastRow = txSheet.getLastRow();
    if (lastRow === allTx.length + 1 || (lastRow <= 1 && allTx.length === 0)) {
      var lastId = allTx.length > 0 ? allTx[allTx.length - 1].id : '';
      saveOutstandingState(lastRow, lastId, outstandingList);
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

  const recentResult = {
    employees: employees,
    tools: tools,
    transactions: filteredTx,
    total_transactions_count: allTx.length,
    has_full_history: false
  };
  if (getCacheVersion() === verBefore) {
    putChunkedCache(cacheKey, recentResult);
  }
  return recentResult;
}

function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return [];
  const rawHeaders = data[0];
  const keys = [];
  for (var c = 0; c < rawHeaders.length; c++) {
    var h = rawHeaders[c];
    keys.push((h === null || h === undefined ? '' : h).toString().trim().toLowerCase());
  }

  const result = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var obj = {};
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key) {
        var val = row[i];
        obj[key] = val instanceof Date ? val.toISOString() : val;
      }
    }
    result.push(obj);
  }
  return result;
}

function addTransaction(data, type) {
  // Single transactions go through the same validated batch path.
  const tx = Object.assign({}, data, { action: type });
  const res = addBatchTransactions([tx]);
  return { status: 'recorded', id: res.ids[0], transaction: res.transactions[0] };
}

function addBatchTransactions(transactions) {
  if (!transactions || !transactions.length) throw new Error('No transactions');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  if (!sheet) throw new Error('Transactions sheet not found');
  const results = [];
  const rows = [];
  const recordedTxs = [];

  // Basic validation
  for (let v = 0; v < transactions.length; v++) {
    const t = transactions[v];
    if (t.action !== 'BORROW' && t.action !== 'RETURN') {
      throw new Error('Invalid action: ' + t.action);
    }
    if (!normalizeId(t.tool_id)) throw new Error('tool_id is required');
    if (!normalizeId(t.employee_id)) throw new Error('employee_id is required');
  }

  const hasBorrow = transactions.some(function(t) { return t.action === 'BORROW'; });

  // Guard 1: Check UNSERVICEABLE tools (only needed when borrowing; RETURN-only skips Tools sheet)
  if (hasBorrow) {
    const usMap = getUnserviceableMap(ss);
    for (let j = 0; j < transactions.length; j++) {
      const t = transactions[j];
      if (t.action === 'BORROW' && usMap[normalizeId(t.tool_id)]) {
        throw new Error('อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" อยู่ในสถานะชำรุด (U/S) ไม่สามารถเบิกได้');
      }
    }
  }

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();

  transactions.forEach((data) => {
    const uuid = Utilities.getUuid();
    const sToolId = sanitizeCell(data.tool_id);
    const sToolName = sanitizeCell(data.tool_name);
    const sEmpId = sanitizeCell(data.employee_id);
    const sEmpName = sanitizeCell(data.employee_name);
    const qty = data.quantity || 1;
    const sIssuer = sanitizeCell(data.staff_issuer || '-');
    const sReceiver = sanitizeCell(data.staff_receiver || '-');
    const sLinked = sanitizeCell(data.linked_borrow_id || '-');
    const sRemark = sanitizeCell(data.remark || '-');

    const newRow = [
      uuid,           // id
      nowDate,        // date
      data.action,    // action
      sToolId,
      sToolName,
      sEmpId,
      sEmpName,
      qty,
      sIssuer,
      sReceiver,
      sLinked,
      sRemark
    ];
    rows.push(newRow);
    results.push(uuid);
    recordedTxs.push({
      id: uuid,
      date: nowIso,
      action: data.action,
      tool_id: sToolId,
      tool_name: sToolName,
      employee_id: sEmpId,
      employee_name: sEmpName,
      quantity: qty,
      staff_issuer: sIssuer,
      staff_receiver: sReceiver,
      linked_borrow_id: sLinked,
      remark: sRemark
    });
  });

  // Guard 2: a tool that is still borrowed cannot be borrowed again.
  // Runs under ScriptLock (see processRequest) using O(1) watermark-verified cache with full-sheet fallback.
  const watermark = readTransactionsWatermark(sheet);
  const cachedState = getCachedOutstandingState(watermark);
  let nextOutstandingList = null;

  if (hasBorrow) {
    const baseList = cachedState
      ? cachedState.outstandingList
      : computeOutstanding(getSheetData(ss, 'Transactions')).outstandingList;
    nextOutstandingList = applyTransactionsToOutstanding(baseList, recordedTxs);
  } else if (cachedState) {
    nextOutstandingList = applyTransactionsToOutstanding(cachedState.outstandingList, recordedTxs);
  }

  // Append all rows at once using getRange & setValues
  sheet.getRange(watermark.lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);

  if (nextOutstandingList !== null) {
    saveOutstandingState(watermark.lastRow + rows.length, results[results.length - 1], nextOutstandingList);
  } else {
    clearOutstandingStateCache();
  }

  return { status: 'batch_recorded', count: transactions.length, ids: results, transactions: recordedTxs };
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

  const nowDate = new Date();
  const nowIso = nowDate.toISOString();
  const cleanReason = status === 'UNSERVICEABLE' ? sanitizeCell(data.reason || '') : '';
  const cleanBy = status === 'UNSERVICEABLE' ? sanitizeCell(data.marked_by || '') : '';
  const values = status === 'UNSERVICEABLE'
    ? ['UNSERVICEABLE', cleanReason, nowDate, cleanBy]
    : ['SERVICEABLE', '', '', ''];
  sheet.getRange(rowIndex, statusCol + 1, 1, 4).setValues([values]);

  return {
    status: 'updated',
    tool_id: data.tool_id,
    serviceability_status: status,
    unserviceable_reason: cleanReason,
    unserviceable_date: status === 'UNSERVICEABLE' ? nowIso : '',
    unserviceable_by: cleanBy
  };
}
