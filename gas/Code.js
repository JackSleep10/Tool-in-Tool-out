/*
 * GSE Store Management - Backend Script
 * Copy and paste this code into your Google Apps Script project (Code.gs).
 * Deploy as Web App -> Execute as: Me -> Who has access: Anyone
 */

function doGet(e) {
  // If we have an action parameter, treat it as an API call
  if (e && e.parameter && e.parameter.action) {
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

/**
 * Core API dispatcher shared by HTTP (doGet/doPost) and google.script.run (runApiAction).
 * Returns a plain JSON-serializable object with timing breakdown.
 */
function processApiRequest(action, payload) {
  var totalStart = Date.now();
  var timing = {
    lock_wait: 0,
    guard_tools: 0,
    guard_tx: 0,
    write: 0,
    flush: 0,
    cache: 0,
    total: 0
  };
  var result = { status: 'success', data: null, timing: timing };
  var lock = null;

  try {
    if (WRITE_ACTIONS.indexOf(action) !== -1) {
      var lockStart = Date.now();
      lock = LockService.getScriptLock();
      if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
        timing.lock_wait = Date.now() - lockStart;
        throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่อีกครั้ง');
      }
      timing.lock_wait = Date.now() - lockStart;
    }

    // Router
    // NOTE: RUN_TOOL_MIGRATION was intentionally removed from the public API.
    // runToolMigration() clears the Tools sheet, so it must only be run
    // manually from the Apps Script editor.
    switch (action) {
      case 'GET_ALL_DATA':
        result.data = getAllData(payload, timing);
        break;
      case 'GET_FULL_HISTORY':
        result.data = getFullHistoryData(timing);
        break;
      case 'BORROW':
        result.data = addTransaction(payload, 'BORROW', timing);
        break;
      case 'RETURN':
        result.data = addTransaction(payload, 'RETURN', timing);
        break;
      case 'BATCH_TRANSACTIONS':
        result.data = addBatchTransactions(payload.transactions, timing);
        break;
      case 'MARK_UNSERVICEABLE':
        result.data = markToolServiceability(payload, 'UNSERVICEABLE', false, timing);
        break;
      case 'MARK_SERVICEABLE':
        result.data = markToolServiceability(payload, 'SERVICEABLE', false, timing);
        break;
      default:
        result.status = 'error';
        result.message = 'Unknown action: ' + action;
    }
  } catch (err) {
    result.status = 'error';
    result.data = null;
    result.message = (err && err.message) ? err.message : String(err);
  } finally {
    if (lock) lock.releaseLock();
  }

  timing.total = Date.now() - totalStart;
  return result;
}

function handleRequest(e) {
  // Note: Google Apps Script handles CORS automatically for Web Apps

  // Handle Options request (Preflight)
  if (e && e.parameter && e.parameter.method === 'OPTIONS') {
    return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
  }

  var action = e && e.parameter ? e.parameter.action : null;
  var payload = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(k) {
      payload[k] = e.parameter[k];
    });
  }

  try {
    if (e && e.postData && e.postData.contents) {
      var data = JSON.parse(e.postData.contents);
      action = data.action || action;
      payload = data;
    }
  } catch (parseErr) {
    var errResult = {
      status: 'error',
      data: null,
      message: 'Invalid JSON payload: ' + ((parseErr && parseErr.message) ? parseErr.message : String(parseErr))
    };
    return ContentService.createTextOutput(JSON.stringify(errResult))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var result = processApiRequest(action, payload);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * RPC entrypoint for google.script.run when the frontend runs inside GAS HtmlService.
 * Always returns a JSON string so Google Apps Script never drops Date objects into null.
 */
function runApiAction(jsonPayload) {
  try {
    var data = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : (jsonPayload || {});
    var result = processApiRequest(data.action, data);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({
      status: 'error',
      data: null,
      message: (err && err.message) ? err.message : String(err)
    });
  }
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

// --- Per-Sheet Cache Helpers (M1 + Speed Plan Phase 2/3) ---
const EMPLOYEES_CACHE_TTL_SEC = 1800; // 30 minutes (rarely changes)
const DATA_CACHE_TTL_SEC = 300;       // 5 minutes (safe via atomic version swap on writes)
const CACHE_CHUNK_CHARS = 30000;      // <= 90 KB even when all characters are 3-byte Thai UTF-8
const CACHE_MAX_CHUNKS = 80;

const CACHE_VER_PROP_EMP = 'DATA_CACHE_VER_EMP';
const CACHE_VER_PROP_TOOLS = 'DATA_CACHE_VER_TOOLS';
const CACHE_VER_PROP_TX = 'DATA_CACHE_VER_TX';

function nextCacheVersion() {
  return Date.now() + '_' + Math.floor(Math.random() * 100000);
}

function getDataVersions() {
  try {
    if (typeof PropertiesService === 'undefined') {
      return { emp: '1', tools: '1', tx: '1', composite: '1:1:1' };
    }
    var props = PropertiesService.getScriptProperties();
    var allProps = typeof props.getProperties === 'function' ? props.getProperties() : null;
    var emp = allProps ? allProps[CACHE_VER_PROP_EMP] : props.getProperty(CACHE_VER_PROP_EMP);
    var tools = allProps ? allProps[CACHE_VER_PROP_TOOLS] : props.getProperty(CACHE_VER_PROP_TOOLS);
    var tx = allProps ? allProps[CACHE_VER_PROP_TX] : props.getProperty(CACHE_VER_PROP_TX);

    var toSet = {};
    var needWrite = false;
    var seed = String(Date.now());
    if (!emp) {
      emp = seed;
      toSet[CACHE_VER_PROP_EMP] = emp;
      needWrite = true;
    }
    if (!tools) {
      tools = seed;
      toSet[CACHE_VER_PROP_TOOLS] = tools;
      needWrite = true;
    }
    if (!tx) {
      tx = seed;
      toSet[CACHE_VER_PROP_TX] = tx;
      needWrite = true;
    }
    if (needWrite) {
      if (typeof props.setProperties === 'function') {
        props.setProperties(toSet);
      } else {
        Object.keys(toSet).forEach(function(k) {
          props.setProperty(k, toSet[k]);
        });
      }
    }
    return {
      emp: emp,
      tools: tools,
      tx: tx,
      composite: emp + ':' + tools + ':' + tx
    };
  } catch (e) {
    return { emp: '1', tools: '1', tx: '1', composite: '1:1:1' };
  }
}

function setSheetCacheVersion(propName, nextVer) {
  try {
    if (typeof PropertiesService === 'undefined') return;
    PropertiesService.getScriptProperties().setProperty(propName, String(nextVer));
  } catch (e) {
    // Non-fatal: cache expires by TTL
  }
}

function getChunkedCacheWithVer(baseKey, ver) {
  try {
    if (typeof CacheService === 'undefined') return null;
    var cache = CacheService.getScriptCache();
    var prefix = baseKey + '_v' + ver;
    var metaStr = cache.get(prefix + '_meta');
    if (!metaStr) return null;

    var meta = JSON.parse(metaStr);
    if (!meta || !meta.chunks || meta.chunks <= 0 || meta.chunks > CACHE_MAX_CHUNKS) return null;

    var keys = [];
    for (var i = 0; i < meta.chunks; i++) {
      keys.push(prefix + '_c' + i);
    }

    var valuesByKey = typeof cache.getAll === 'function' ? cache.getAll(keys) : null;
    var parts = [];
    for (var j = 0; j < keys.length; j++) {
      var part = valuesByKey ? valuesByKey[keys[j]] : cache.get(keys[j]);
      if (part === null || part === undefined) return null;
      parts.push(part);
    }
    return JSON.parse(parts.join(''));
  } catch (e) {
    return null;
  }
}

function putChunkedCacheWithVer(baseKey, ver, value, ttlSec) {
  try {
    if (typeof CacheService === 'undefined') return false;
    var cache = CacheService.getScriptCache();
    var json = JSON.stringify(value);
    var totalChunks = Math.ceil(json.length / CACHE_CHUNK_CHARS);
    if (totalChunks <= 0 || totalChunks > CACHE_MAX_CHUNKS) return false;

    var ttl = ttlSec || DATA_CACHE_TTL_SEC;
    var prefix = baseKey + '_v' + ver;
    var entries = {};
    for (var i = 0; i < totalChunks; i++) {
      entries[prefix + '_c' + i] = json.slice(i * CACHE_CHUNK_CHARS, (i + 1) * CACHE_CHUNK_CHARS);
    }
    entries[prefix + '_meta'] = JSON.stringify({ chunks: totalChunks });

    if (typeof cache.putAll === 'function') {
      cache.putAll(entries, ttl);
    } else {
      Object.keys(entries).forEach(function(k) {
        cache.put(k, entries[k], ttl);
      });
    }
    return true;
  } catch (e) {
    return false;
  }
}

function buildToolDerivedCaches(tools) {
  var usMap = {};
  var rowMap = {};
  for (var i = 0; i < tools.length; i++) {
    var tool = tools[i];
    if (!tool) continue;
    var tid = normalizeId(tool.id);
    if (!tid) continue;
    if (rowMap[tid] === undefined) {
      rowMap[tid] = i + 2; // 1-indexed sheet row (row 1 is header)
    }
    var stat = (tool.serviceability_status || '').toString().toUpperCase().trim();
    if (stat === 'UNSERVICEABLE') {
      usMap[tid] = true;
    }
  }
  return { usMap: usMap, rowMap: rowMap };
}

function buildOutstandingMap(outstandingList) {
  var outByTool = {};
  for (var i = 0; i < outstandingList.length; i++) {
    var b = outstandingList[i];
    if (!b) continue;
    var key = normalizeId(b.tool_id);
    if (key) {
      outByTool[key] = {
        id: b.id,
        tool_id: b.tool_id,
        employee_id: b.employee_id,
        employee_name: b.employee_name
      };
    }
  }
  return outByTool;
}

function getCachedEmployees(getSs, empVer) {
  var cached = getChunkedCacheWithVer('sheet_employees', empVer);
  if (cached) return cached;
  var employees = getSheetData(getSs(), 'Employees');
  putChunkedCacheWithVer('sheet_employees', empVer, employees, EMPLOYEES_CACHE_TTL_SEC);
  return employees;
}

function getCachedTools(getSs, toolsVer) {
  var cached = getChunkedCacheWithVer('sheet_tools', toolsVer);
  if (cached) return cached;
  var tools = getSheetData(getSs(), 'Tools');
  putChunkedCacheWithVer('sheet_tools', toolsVer, tools, DATA_CACHE_TTL_SEC);
  var derived = buildToolDerivedCaches(tools);
  putChunkedCacheWithVer('tools_us_map', toolsVer, derived.usMap, DATA_CACHE_TTL_SEC);
  putChunkedCacheWithVer('tools_row_map', toolsVer, derived.rowMap, DATA_CACHE_TTL_SEC);
  return tools;
}

function buildRecentTransactionsPayload(allTx) {
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
    recent: {
      transactions: filteredTx,
      total_transactions_count: allTx.length
    },
    outByTool: buildOutstandingMap(outstandingList)
  };
}

function getCachedTransactionsRecent(getSs, txVer) {
  var cached = getChunkedCacheWithVer('tx_recent', txVer);
  if (cached) return cached;
  var allTx = getSheetData(getSs(), 'Transactions');
  var built = buildRecentTransactionsPayload(allTx);
  putChunkedCacheWithVer('tx_recent', txVer, built.recent, DATA_CACHE_TTL_SEC);
  putChunkedCacheWithVer('tx_outstanding', txVer, built.outByTool, DATA_CACHE_TTL_SEC);
  return built.recent;
}

function getCachedTransactionsFull(getSs, txVer) {
  var cached = getChunkedCacheWithVer('tx_full', txVer);
  if (cached) return cached;
  var allTx = getSheetData(getSs(), 'Transactions');
  var full = {
    transactions: allTx,
    total_transactions_count: allTx.length,
    has_full_history: true
  };
  putChunkedCacheWithVer('tx_full', txVer, full, DATA_CACHE_TTL_SEC);
  return full;
}

function getFullHistoryData(timing) {
  var start = Date.now();
  var versions = getDataVersions();
  var ss = null;
  var getSs = function() {
    if (!ss) ss = getSpreadsheet();
    return ss;
  };
  var full = getCachedTransactionsFull(getSs, versions.tx);
  if (timing) timing.cache = Date.now() - start;
  return {
    transactions: full.transactions,
    has_full_history: true,
    data_version: versions.composite
  };
}

function getAllData(payload, timing) {
  var start = Date.now();
  var versions = getDataVersions();
  var wantFull = !!(payload && (payload.full_history === true || payload.full_history === 'true'));
  var clientVersion = payload && payload.client_version ? String(payload.client_version) : '';

  // Version-checked poll short-circuit: 0 cache reads, 0 sheet reads
  if (clientVersion && clientVersion === versions.composite) {
    if (timing) timing.cache = Date.now() - start;
    return {
      unchanged: true,
      data_version: versions.composite,
      has_full_history: wantFull
    };
  }

  var ss = null;
  var getSs = function() {
    if (!ss) ss = getSpreadsheet();
    return ss;
  };

  var employees = getCachedEmployees(getSs, versions.emp);
  var tools = getCachedTools(getSs, versions.tools);

  if (wantFull) {
    var fullTx = getCachedTransactionsFull(getSs, versions.tx);
    if (timing) timing.cache = Date.now() - start;
    return {
      employees: employees,
      tools: tools,
      transactions: fullTx.transactions,
      total_transactions_count: fullTx.total_transactions_count,
      has_full_history: true,
      data_version: versions.composite
    };
  }

  var recentTx = getCachedTransactionsRecent(getSs, versions.tx);
  if (timing) timing.cache = Date.now() - start;
  return {
    employees: employees,
    tools: tools,
    transactions: recentTx.transactions,
    total_transactions_count: recentTx.total_transactions_count,
    has_full_history: false,
    data_version: versions.composite
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

function canReadRangeValues(sheet) {
  return typeof sheet.getLastColumn === 'function' &&
    typeof sheet.getRange === 'function' &&
    typeof sheet.getRange(1, 1, 1, 1).getValues === 'function';
}

function loadUnserviceableMap(ss, toolsVer) {
  var cached = getChunkedCacheWithVer('tools_us_map', toolsVer);
  if (cached) return cached;

  var toolsSheet = ss.getSheetByName('Tools');
  var usMap = {};
  if (!toolsSheet) return usMap;

  var lastRow = toolsSheet.getLastRow();
  if (lastRow <= 1) {
    putChunkedCacheWithVer('tools_us_map', toolsVer, usMap, DATA_CACHE_TTL_SEC);
    return usMap;
  }

  if (canReadRangeValues(toolsSheet)) {
    var lastCol = toolsSheet.getLastColumn();
    if (lastCol > 0) {
      var headerRow = toolsSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var headers = headerRow.map(function(h) {
        return (h === null || h === undefined ? '' : h).toString().trim().toLowerCase();
      });
      var idCol = headers.indexOf('id');
      var statCol = headers.indexOf('serviceability_status');
      if (idCol !== -1 && statCol !== -1) {
        var idVals = toolsSheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
        var statVals = toolsSheet.getRange(2, statCol + 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < idVals.length; i++) {
          var tid = normalizeId(idVals[i][0]);
          var stat = (statVals[i][0] || '').toString().toUpperCase().trim();
          if (tid && stat === 'UNSERVICEABLE') usMap[tid] = true;
        }
      }
      putChunkedCacheWithVer('tools_us_map', toolsVer, usMap, DATA_CACHE_TTL_SEC);
      return usMap;
    }
  }

  // Fallback for environments without getLastColumn / getRange().getValues()
  var toolsData = toolsSheet.getDataRange().getValues();
  if (toolsData.length > 0) {
    var tHeaders = toolsData[0].map(function(h) {
      return (h === null || h === undefined ? '' : h).toString().trim().toLowerCase();
    });
    var fIdCol = tHeaders.indexOf('id');
    var fStatCol = tHeaders.indexOf('serviceability_status');
    if (fIdCol !== -1 && fStatCol !== -1) {
      for (var j = 1; j < toolsData.length; j++) {
        var fTid = normalizeId(toolsData[j][fIdCol]);
        var fStat = (toolsData[j][fStatCol] || '').toString().toUpperCase().trim();
        if (fTid && fStat === 'UNSERVICEABLE') usMap[fTid] = true;
      }
    }
  }
  putChunkedCacheWithVer('tools_us_map', toolsVer, usMap, DATA_CACHE_TTL_SEC);
  return usMap;
}

function addTransaction(data, type, timing) {
  // Single transactions go through the same validated batch path.
  const tx = Object.assign({}, data, { action: type });
  const res = addBatchTransactions([tx], timing);
  return {
    status: 'recorded',
    id: res.ids[0],
    record: res.records[0],
    records: res.records,
    data_version: res.data_version
  };
}

function addBatchTransactions(transactions, timing) {
  if (!transactions || !transactions.length) throw new Error('No transactions');

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Transactions');
  if (!sheet) throw new Error('Transactions sheet not found');

  const versions = getDataVersions();
  const results = [];
  const rows = [];
  const createdRecords = [];

  // Basic validation
  for (let v = 0; v < transactions.length; v++) {
    const t = transactions[v];
    if (t.action !== 'BORROW' && t.action !== 'RETURN') {
      throw new Error('Invalid action: ' + t.action);
    }
    if (!normalizeId(t.tool_id)) throw new Error('tool_id is required');
    if (!normalizeId(t.employee_id)) throw new Error('employee_id is required');
  }

  // Only BORROW batches need U/S tool check and duplicate-borrow guard.
  // RETURN-only batches skip reading both Tools and Transactions sheets completely.
  const hasBorrow = transactions.some(t => t.action === 'BORROW');
  let outByTool = null;

  if (hasBorrow) {
    // Guard 1: Check if any BORROW item is UNSERVICEABLE (uses tools_us_map cache when warm)
    var guardToolsStart = Date.now();
    var usMap = loadUnserviceableMap(ss, versions.tools);
    for (let j = 0; j < transactions.length; j++) {
      const t = transactions[j];
      if (t.action === 'BORROW' && usMap[normalizeId(t.tool_id)]) {
        if (timing) timing.guard_tools = Date.now() - guardToolsStart;
        throw new Error('อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" อยู่ในสถานะชำรุด (U/S) ไม่สามารถเบิกได้');
      }
    }
    if (timing) timing.guard_tools = Date.now() - guardToolsStart;

    // Guard 2: a tool that is still borrowed cannot be borrowed again.
    // Uses tx_outstanding index cache when warm; falls back to full replay on cache miss.
    var guardTxStart = Date.now();
    var cachedOut = getChunkedCacheWithVer('tx_outstanding', versions.tx);
    if (cachedOut) {
      outByTool = Object.assign({}, cachedOut);
    } else {
      const replay = computeOutstanding(getSheetData(ss, 'Transactions'));
      outByTool = buildOutstandingMap(replay.outstandingList);
    }

    // Apply this batch in order so RETURN-then-BORROW in one batch is allowed.
    for (let k = 0; k < transactions.length; k++) {
      const t = transactions[k];
      const key = normalizeId(t.tool_id);
      if (t.action === 'RETURN') {
        delete outByTool[key];
      } else {
        const existing = outByTool[key];
        if (existing) {
          if (timing) timing.guard_tx = Date.now() - guardTxStart;
          throw new Error('อุปกรณ์ "' + (t.tool_name || t.tool_id) + '" ถูกยืมอยู่แล้วโดย ' +
            (existing.employee_name || '') + ' (' + (existing.employee_id || '') + ')');
        }
        outByTool[key] = {
          tool_id: t.tool_id,
          employee_id: t.employee_id,
          employee_name: t.employee_name
        };
      }
    }
    if (timing) timing.guard_tx = Date.now() - guardTxStart;
  }

  var writeStart = Date.now();
  transactions.forEach((data) => {
    const uuid = Utilities.getUuid();
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const toolIdVal = sanitizeCell(data.tool_id);
    const toolNameVal = sanitizeCell(data.tool_name);
    const empIdVal = sanitizeCell(data.employee_id);
    const empNameVal = sanitizeCell(data.employee_name);
    const qtyVal = data.quantity || 1;
    const issuerVal = sanitizeCell(data.staff_issuer || '-');
    const receiverVal = sanitizeCell(data.staff_receiver || '-');
    const linkedVal = sanitizeCell(data.linked_borrow_id || '-');
    const remarkVal = sanitizeCell(data.remark || '-');

    const newRow = [
      uuid,          // id
      nowDate,       // date
      data.action,   // action
      toolIdVal,
      toolNameVal,
      empIdVal,
      empNameVal,
      qtyVal,
      issuerVal,
      receiverVal,
      linkedVal,
      remarkVal
    ];
    rows.push(newRow);
    results.push(uuid);
    createdRecords.push({
      id: uuid,
      date: nowIso,
      action: data.action,
      tool_id: toolIdVal,
      tool_name: toolNameVal,
      employee_id: empIdVal,
      employee_name: empNameVal,
      quantity: qtyVal,
      staff_issuer: issuerVal,
      staff_receiver: receiverVal,
      linked_borrow_id: linkedVal,
      remark: remarkVal
    });
  });

  // Append all rows at once using getRange & setValues
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  if (timing) timing.write = Date.now() - writeStart;

  var flushStart = Date.now();
  SpreadsheetApp.flush();
  if (timing) timing.flush = Date.now() - flushStart;

  // Atomic version-swap write-through cache update (only Transactions version changes;
  // Employees and Tools caches stay warm!)
  var cacheStart = Date.now();
  var nextTxVer = nextCacheVersion();

  var prevRecent = getChunkedCacheWithVer('tx_recent', versions.tx);
  if (prevRecent && Array.isArray(prevRecent.transactions)) {
    putChunkedCacheWithVer('tx_recent', nextTxVer, {
      transactions: prevRecent.transactions.concat(createdRecords),
      total_transactions_count: (prevRecent.total_transactions_count || prevRecent.transactions.length) + createdRecords.length
    }, DATA_CACHE_TTL_SEC);
  }

  var prevFull = getChunkedCacheWithVer('tx_full', versions.tx);
  if (prevFull && Array.isArray(prevFull.transactions)) {
    putChunkedCacheWithVer('tx_full', nextTxVer, {
      transactions: prevFull.transactions.concat(createdRecords),
      total_transactions_count: prevFull.transactions.length + createdRecords.length,
      has_full_history: true
    }, DATA_CACHE_TTL_SEC);
  }

  // Update tx_outstanding index for next BORROW guard
  if (!outByTool) {
    var prevOut = getChunkedCacheWithVer('tx_outstanding', versions.tx);
    if (prevOut) {
      outByTool = Object.assign({}, prevOut);
      for (var rIdx = 0; rIdx < createdRecords.length; rIdx++) {
        var rec = createdRecords[rIdx];
        var recKey = normalizeId(rec.tool_id);
        if (rec.action === 'RETURN') {
          delete outByTool[recKey];
        } else {
          outByTool[recKey] = {
            id: rec.id,
            tool_id: rec.tool_id,
            employee_id: rec.employee_id,
            employee_name: rec.employee_name
          };
        }
      }
    }
  } else {
    // Attach generated UUIDs to newly inserted BORROW entries in outByTool
    for (var bIdx = 0; bIdx < createdRecords.length; bIdx++) {
      var bRec = createdRecords[bIdx];
      var bKey = normalizeId(bRec.tool_id);
      if (bRec.action === 'BORROW' && outByTool[bKey]) {
        outByTool[bKey] = {
          id: bRec.id,
          tool_id: bRec.tool_id,
          employee_id: bRec.employee_id,
          employee_name: bRec.employee_name
        };
      }
    }
  }

  if (outByTool) {
    putChunkedCacheWithVer('tx_outstanding', nextTxVer, outByTool, DATA_CACHE_TTL_SEC);
  }

  // Swap version pointer LAST so readers never observe partially written cache entries
  setSheetCacheVersion(CACHE_VER_PROP_TX, nextTxVer);
  if (timing) timing.cache = Date.now() - cacheStart;

  var newCompositeVersion = versions.emp + ':' + versions.tools + ':' + nextTxVer;
  return {
    status: 'batch_recorded',
    count: transactions.length,
    ids: results,
    records: createdRecords,
    data_version: newCompositeVersion
  };
}

function markToolServiceability(data, status, _retry, timing) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Tools');
  if (!sheet) throw new Error('Tools sheet not found');

  if (!data.tool_id) throw new Error('tool_id is required');

  const versions = getDataVersions();
  const toolId = normalizeId(data.tool_id);
  const guardStart = Date.now();

  let headers = null;
  let rowIndex = -1;
  let lastRow = sheet.getLastRow();
  if (lastRow === 0) throw new Error('Tools sheet is empty');

  const useRangeReads = canReadRangeValues(sheet);
  if (useRangeReads) {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) throw new Error('Tools sheet is empty');
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
      return (h === null || h === undefined ? '' : h).toString().trim().toLowerCase();
    });
  } else {
    const allData = sheet.getDataRange().getValues();
    if (!allData || allData.length === 0) throw new Error('Tools sheet is empty');
    headers = allData[0].map(function(h) {
      return (h === null || h === undefined ? '' : h).toString().trim().toLowerCase();
    });
    for (let i = 1; i < allData.length; i++) {
      if (normalizeId(allData[i][headers.indexOf('id')]) === toolId) {
        rowIndex = i + 1;
        break;
      }
    }
  }

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
    return markToolServiceability(data, status, true, timing);
  }

  // Ensure all serviceability columns exist
  if (reasonCol === -1 || dateCol === -1 || byCol === -1) {
    throw new Error('Missing serviceability columns in Tools sheet');
  }

  // Locate target tool row using cached row map (1-cell verification) or ID-column-only read
  if (useRangeReads && rowIndex === -1 && lastRow > 1) {
    var cachedRowMap = getChunkedCacheWithVer('tools_row_map', versions.tools);
    var hintedRow = cachedRowMap ? cachedRowMap[toolId] : null;
    if (hintedRow && hintedRow >= 2 && hintedRow <= lastRow) {
      var checkVal = sheet.getRange(hintedRow, idCol + 1, 1, 1).getValues()[0][0];
      if (normalizeId(checkVal) === toolId) {
        rowIndex = hintedRow;
      }
    }
    if (rowIndex === -1) {
      var idValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
      for (let r = 0; r < idValues.length; r++) {
        if (normalizeId(idValues[r][0]) === toolId) {
          rowIndex = r + 2;
          break;
        }
      }
    }
  }

  if (timing) timing.guard_tools = Date.now() - guardStart;
  if (rowIndex === -1) throw new Error('Tool not found: ' + data.tool_id);

  var writeStart = Date.now();
  var nowDate = new Date();
  var nowIso = nowDate.toISOString();
  var reasonVal = status === 'UNSERVICEABLE' ? sanitizeCell(data.reason || '') : '';
  var byVal = status === 'UNSERVICEABLE' ? sanitizeCell(data.marked_by || '') : '';
  var values = status === 'UNSERVICEABLE'
    ? ['UNSERVICEABLE', reasonVal, nowDate, byVal]
    : ['SERVICEABLE', '', '', ''];
  sheet.getRange(rowIndex, statusCol + 1, 1, 4).setValues([values]);
  if (timing) timing.write = Date.now() - writeStart;

  var flushStart = Date.now();
  SpreadsheetApp.flush();
  if (timing) timing.flush = Date.now() - flushStart;

  var toolPatch = status === 'UNSERVICEABLE'
    ? {
      serviceability_status: 'UNSERVICEABLE',
      unserviceable_reason: reasonVal,
      unserviceable_date: nowIso,
      unserviceable_by: byVal
    }
    : {
      serviceability_status: 'SERVICEABLE',
      unserviceable_reason: '',
      unserviceable_date: '',
      unserviceable_by: ''
    };

  // Atomic version-swap write-through cache update (only Tools version changes;
  // Employees and Transactions caches stay warm!)
  var cacheStart = Date.now();
  var nextToolsVer = nextCacheVersion();

  var prevTools = getChunkedCacheWithVer('sheet_tools', versions.tools);
  if (Array.isArray(prevTools)) {
    var updatedTools = prevTools.map(function(t) {
      if (t && normalizeId(t.id) === toolId) {
        return Object.assign({}, t, toolPatch);
      }
      return t;
    });
    putChunkedCacheWithVer('sheet_tools', nextToolsVer, updatedTools, DATA_CACHE_TTL_SEC);
  }

  var prevUsMap = getChunkedCacheWithVer('tools_us_map', versions.tools);
  if (prevUsMap) {
    var updatedUsMap = Object.assign({}, prevUsMap);
    if (status === 'UNSERVICEABLE') {
      updatedUsMap[toolId] = true;
    } else {
      delete updatedUsMap[toolId];
    }
    putChunkedCacheWithVer('tools_us_map', nextToolsVer, updatedUsMap, DATA_CACHE_TTL_SEC);
  }

  var prevRowMap = getChunkedCacheWithVer('tools_row_map', versions.tools);
  if (prevRowMap) {
    putChunkedCacheWithVer('tools_row_map', nextToolsVer, prevRowMap, DATA_CACHE_TTL_SEC);
  }

  setSheetCacheVersion(CACHE_VER_PROP_TOOLS, nextToolsVer);
  if (timing) timing.cache = Date.now() - cacheStart;

  var newCompositeVersion = versions.emp + ':' + nextToolsVer + ':' + versions.tx;
  return {
    status: 'updated',
    tool_id: data.tool_id,
    tool_patch: toolPatch,
    data_version: newCompositeVersion
  };
}

// --- Optional Keep-Warm Trigger Helpers (Speed Plan Phase 4) ---

/**
 * Warms per-sheet caches during Bangkok working hours (07:00 - 19:00) to reduce GAS cold starts
 * without burning daily execution quota overnight.
 */
function keepWarm() {
  var hour = Number(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'H'));
  if (hour < 7 || hour >= 19) {
    return { skipped: true, reason: 'outside_working_hours', hour: hour };
  }
  getAllData({});
  return { warmed: true, hour: hour };
}

/**
 * Run once manually from Apps Script Editor to enable a 10-minute keepWarm trigger.
 */
function setupKeepWarmTrigger() {
  removeKeepWarmTrigger();
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(10).create();
}

/**
 * Run manually from Apps Script Editor to disable all keepWarm triggers.
 */
function removeKeepWarmTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'keepWarm') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
