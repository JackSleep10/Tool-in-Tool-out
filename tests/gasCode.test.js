import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, it, expect, beforeEach } from 'vitest';

function createGasVm({ mockHour = 10 } = {}) {
  const state = {
    sheetReads: 0,
    sheetReadsBySheet: { Employees: 0, Tools: 0, Transactions: 0 },
    rangeReadsBySheet: { Employees: 0, Tools: 0, Transactions: 0 },
    cacheReads: 0,
    lockCalls: 0,
    flushCalls: 0,
    mockHour,
    cacheStore: new Map(),
    propsStore: new Map(),
    sheets: {
      Employees: [
        ['id', 'name', 'department'],
        ['EMP-01', 'Somchai', 'Line'],
        ['EMP-02', 'Suda', 'Base']
      ],
      Tools: [
        ['ID ', ' Name', 'Location', 'serviceability_status', 'unserviceable_reason', 'unserviceable_date', 'unserviceable_by'],
        ['T-01', 'Wrench ' + 'ก'.repeat(400), 'Wall 1 No.1', 'SERVICEABLE', '', '', ''],
        ['T-02', 'Broken Drill', 'Wall 2 No.1', 'UNSERVICEABLE', 'Motor', '2026-01-01', 'Admin'],
        ...Array.from({ length: 120 }, (_, i) => [
          `T-BULK-${i}`,
          'เครื่องมือทดสอบ ' + 'ข'.repeat(250),
          'Wall 3 No.1',
          'SERVICEABLE',
          '',
          '',
          ''
        ])
      ],
      Transactions: [
        ['id', 'date', 'action', 'tool_id', 'tool_name', 'employee_id', 'employee_name', 'quantity', 'staff_issuer', 'staff_receiver', 'linked_borrow_id', 'remark'],
        ['B-OLD', '2025-01-01T00:00:00Z', 'BORROW', 'T-01', 'Wrench', 'EMP-01', 'Somchai', 1, 'Staff', '-', '-', '-']
      ]
    }
  };

  const makeSheet = (name) => ({
    getLastRow: () => state.sheets[name].length,
    getLastColumn: () => (state.sheets[name][0] ? state.sheets[name][0].length : 0),
    getDataRange: () => ({
      getValues: () => {
        state.sheetReads++;
        state.sheetReadsBySheet[name] = (state.sheetReadsBySheet[name] || 0) + 1;
        return state.sheets[name].map((r) => r.slice());
      }
    }),
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => {
        state.rangeReadsBySheet[name] = (state.rangeReadsBySheet[name] || 0) + 1;
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const srcRow = state.sheets[name][row - 1 + r] || [];
          const rowOut = [];
          for (let c = 0; c < numCols; c++) {
            rowOut.push(srcRow[col - 1 + c] !== undefined ? srcRow[col - 1 + c] : '');
          }
          out.push(rowOut);
        }
        return out;
      },
      setValues: (vals) => {
        for (let r = 0; r < numRows; r++) {
          const targetRow = row - 1 + r;
          while (state.sheets[name].length <= targetRow) state.sheets[name].push([]);
          for (let c = 0; c < numCols; c++) {
            state.sheets[name][targetRow][col - 1 + c] = vals[r][c];
          }
        }
      }
    })
  });

  let uuidCounter = 1;
  const sandbox = {
    console,
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: (n) => (state.sheets[n] ? makeSheet(n) : null) }),
      getActiveSpreadsheet: () => null,
      flush: () => { state.flushCalls++; }
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { state.lockCalls++; return true; },
        releaseLock: () => {}
      })
    },
    Utilities: {
      getUuid: () => 'uuid-' + uuidCounter++,
      formatDate: () => String(state.mockHour)
    },
    ContentService: {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
      createTextOutput: (txt) => ({ setMimeType: () => txt })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => {
          state.cacheReads++;
          return state.cacheStore.has(k) ? state.cacheStore.get(k) : null;
        },
        getAll: (keys) => {
          state.cacheReads++;
          const out = {};
          keys.forEach((k) => { if (state.cacheStore.has(k)) out[k] = state.cacheStore.get(k); });
          return out;
        },
        put: (k, v) => {
          if (Buffer.byteLength(String(v), 'utf8') >= 100000) {
            throw new Error('Cache entry exceeds 100KB UTF-8 limit');
          }
          state.cacheStore.set(k, String(v));
        },
        putAll: (entries) => {
          Object.entries(entries).forEach(([k, v]) => {
            if (Buffer.byteLength(String(v), 'utf8') >= 100000) {
              throw new Error('Cache entry exceeds 100KB UTF-8 limit');
            }
            state.cacheStore.set(k, String(v));
          });
        }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => state.propsStore.get(k) ?? null,
        getProperties: () => Object.fromEntries(state.propsStore.entries()),
        setProperty: (k, v) => { state.propsStore.set(k, String(v)); },
        setProperties: (obj) => {
          Object.entries(obj).forEach(([k, v]) => state.propsStore.set(k, String(v)));
        }
      })
    }
  };

  vm.createContext(sandbox);
  const codePath = path.resolve(process.cwd(), 'gas/Code.js');
  vm.runInContext(fs.readFileSync(codePath, 'utf8'), sandbox);

  const post = (body) =>
    JSON.parse(sandbox.doPost({ parameter: {}, postData: { contents: JSON.stringify(body) } }));
  const get = (params) =>
    JSON.parse(sandbox.doGet({ parameter: params }));
  const rpc = (body) =>
    JSON.parse(sandbox.runApiAction(JSON.stringify(body)));

  const resetCounters = () => {
    state.sheetReads = 0;
    state.sheetReadsBySheet = { Employees: 0, Tools: 0, Transactions: 0 };
    state.rangeReadsBySheet = { Employees: 0, Tools: 0, Transactions: 0 };
    state.cacheReads = 0;
  };

  return { state, sandbox, post, get, rpc, resetCounters };
}

describe('gas/Code.js backend behavior', () => {
  let env;

  beforeEach(() => {
    env = createGasVm();
  });

  it('rejects removed RUN_TOOL_MIGRATION action', () => {
    const res = env.post({ action: 'RUN_TOOL_MIGRATION' });
    expect(res.status).toBe('error');
    expect(res.message).toContain('Unknown action');
    expect(res.timing).toBeDefined();
  });

  it('caches per-sheet across UTF-8 chunks, short-circuits unchanged polls, and write-through updates cache on writes', () => {
    env.resetCounters();
    const first = env.get({ action: 'GET_ALL_DATA' });
    expect(first.status).toBe('success');
    expect(first.data.data_version).toBeTruthy();
    expect(env.state.sheetReads).toBe(3);
    expect(env.state.cacheStore.size).toBeGreaterThan(2);

    // Version-checked poll short-circuit: 0 sheet reads AND 0 cache reads
    env.resetCounters();
    const unchanged = env.post({ action: 'GET_ALL_DATA', client_version: first.data.data_version });
    expect(unchanged.status).toBe('success');
    expect(unchanged.data.unchanged).toBe(true);
    expect(unchanged.data.data_version).toBe(first.data.data_version);
    expect(env.state.sheetReads).toBe(0);
    expect(env.state.cacheReads).toBe(0);

    // Unversioned GET_ALL_DATA hits per-sheet caches with 0 sheet reads
    env.resetCounters();
    const second = env.get({ action: 'GET_ALL_DATA' });
    expect(second.status).toBe('success');
    expect(env.state.sheetReads).toBe(0);
    expect(second.data.tools.length).toBe(first.data.tools.length);

    const empVerBefore = env.state.propsStore.get('DATA_CACHE_VER_EMP');
    const toolsVerBefore = env.state.propsStore.get('DATA_CACHE_VER_TOOLS');
    const txVerBefore = env.state.propsStore.get('DATA_CACHE_VER_TX');

    // RETURN-only batch skips reading BOTH Tools and Transactions sheets
    env.resetCounters();
    const ret = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'RETURN',
        tool_id: 'T-01',
        tool_name: 'Wrench',
        employee_id: 'EMP-01',
        employee_name: 'Somchai',
        linked_borrow_id: 'B-OLD',
        remark: '=SUM(1,1)'
      }]
    });
    expect(ret.status).toBe('success');
    expect(ret.data.status).toBe('batch_recorded');
    expect(ret.data.records).toHaveLength(1);
    expect(ret.data.records[0].id).toBe(ret.data.ids[0]);
    expect(ret.data.records[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(ret.data.data_version).not.toBe(first.data.data_version);
    expect(env.state.sheetReads).toBe(0);
    expect(env.state.rangeReadsBySheet.Tools).toBe(0);
    expect(env.state.rangeReadsBySheet.Transactions).toBe(0);

    // Only Transactions cache version swapped; Employees and Tools versions remain untouched
    expect(env.state.propsStore.get('DATA_CACHE_VER_EMP')).toBe(empVerBefore);
    expect(env.state.propsStore.get('DATA_CACHE_VER_TOOLS')).toBe(toolsVerBefore);
    expect(env.state.propsStore.get('DATA_CACHE_VER_TX')).not.toBe(txVerBefore);

    // Formula injection sanitized while plain '-' preserved
    const appendedRow = env.state.sheets.Transactions[env.state.sheets.Transactions.length - 1];
    expect(appendedRow[9]).toBe('-');
    expect(appendedRow[11]).toBe("'=SUM(1,1)");

    // Next GET_ALL_DATA hits write-through cache (0 sheet reads) and includes new RETURN record
    env.resetCounters();
    const afterWrite = env.get({ action: 'GET_ALL_DATA' });
    expect(afterWrite.status).toBe('success');
    expect(env.state.sheetReads).toBe(0);
    expect(afterWrite.data.transactions.some((t) => t.id === ret.data.ids[0])).toBe(true);
  });

  it('uses warm index caches for BORROW guards and falls back safely when cache is evicted', () => {
    // Warm caches via GET_ALL_DATA
    env.get({ action: 'GET_ALL_DATA' });
    env.resetCounters();

    // T-01 is initially borrowed by EMP-01 (B-OLD) -> blocked via tx_outstanding cache with 0 sheet reads
    const dup = env.post({
      action: 'BORROW',
      tool_id: ' t-01 ',
      tool_name: 'Wrench',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(dup.status).toBe('error');
    expect(env.state.sheetReads).toBe(0);
    expect(env.state.rangeReadsBySheet.Tools).toBe(0);

    // T-02 is UNSERVICEABLE -> blocked via tools_us_map cache with 0 sheet reads
    const us = env.post({
      action: 'BORROW',
      tool_id: 'T-02',
      tool_name: 'Broken Drill',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(us.status).toBe('error');
    expect(env.state.sheetReads).toBe(0);

    // RETURN-then-BORROW in one batch succeeds with 0 sheet reads when warm
    const quickTransfer = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [
        {
          action: 'RETURN',
          tool_id: 'T-01',
          tool_name: 'Wrench',
          employee_id: 'EMP-01',
          employee_name: 'Somchai',
          linked_borrow_id: 'B-OLD'
        },
        {
          action: 'BORROW',
          tool_id: 'T-01',
          tool_name: 'Wrench',
          employee_id: 'EMP-02',
          employee_name: 'Suda'
        }
      ]
    });
    expect(quickTransfer.status).toBe('success');
    expect(quickTransfer.data.count).toBe(2);
    expect(quickTransfer.data.records).toHaveLength(2);
    expect(env.state.sheetReads).toBe(0);
    expect(env.state.lockCalls).toBe(3);
    expect(env.state.flushCalls).toBe(1); // Only successful write flushes

    // Evict all caches -> BORROW guard must fall back to sheet replay and still block T-01 (now held by EMP-02)
    env.state.cacheStore.clear();
    env.resetCounters();
    const dupAfterEvict = env.post({
      action: 'BORROW',
      tool_id: 'T-01',
      tool_name: 'Wrench',
      employee_id: 'EMP-01',
      employee_name: 'Somchai'
    });
    expect(dupAfterEvict.status).toBe('error');
    expect(dupAfterEvict.message).toContain('EMP-02');
    expect(env.state.sheetReadsBySheet.Transactions).toBe(1);
    expect(env.state.sheetReadsBySheet.Tools).toBe(0); // Tools used column-limited range reads
  });

  it('marks tools UNSERVICEABLE/SERVICEABLE using row-map verification and write-through cache', () => {
    // Warm caches
    env.get({ action: 'GET_ALL_DATA' });
    const empVerBefore = env.state.propsStore.get('DATA_CACHE_VER_EMP');
    const txVerBefore = env.state.propsStore.get('DATA_CACHE_VER_TX');
    env.resetCounters();

    const res1 = env.post({
      action: 'MARK_UNSERVICEABLE',
      tool_id: 'T-01',
      reason: 'Cracked handle',
      marked_by: 'Admin'
    });
    expect(res1.status).toBe('success');
    expect(res1.data.tool_patch.serviceability_status).toBe('UNSERVICEABLE');
    expect(res1.data.tool_patch.unserviceable_reason).toBe('Cracked handle');
    expect(res1.data.data_version).toBeTruthy();
    expect(env.state.sheets.Tools[1][3]).toBe('UNSERVICEABLE');
    expect(env.state.sheets.Tools[1][4]).toBe('Cracked handle');
    // Did NOT call full getDataRange() on Tools
    expect(env.state.sheetReadsBySheet.Tools).toBe(0);
    // Employees and Transactions versions untouched
    expect(env.state.propsStore.get('DATA_CACHE_VER_EMP')).toBe(empVerBefore);
    expect(env.state.propsStore.get('DATA_CACHE_VER_TX')).toBe(txVerBefore);

    // Borrowing T-01 is immediately blocked by updated tools_us_map cache
    env.resetCounters();
    const blockedBorrow = env.post({
      action: 'BORROW',
      tool_id: 'T-01',
      tool_name: 'Wrench',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(blockedBorrow.status).toBe('error');
    expect(blockedBorrow.message).toContain('ชำรุด');

    // Restore SERVICEABLE
    const res2 = env.post({ action: 'MARK_SERVICEABLE', tool_id: 'T-01' });
    expect(res2.status).toBe('success');
    expect(res2.data.tool_patch.serviceability_status).toBe('SERVICEABLE');
    expect(env.state.sheets.Tools[1][3]).toBe('SERVICEABLE');
    expect(env.state.sheets.Tools[1][4]).toBe('');

    // GET_ALL_DATA serves updated tool status from write-through cache with 0 sheet reads
    env.resetCounters();
    const afterRestore = env.get({ action: 'GET_ALL_DATA' });
    expect(env.state.sheetReads).toBe(0);
    const t1 = afterRestore.data.tools.find((t) => t.id === 'T-01');
    expect(t1.serviceability_status).toBe('SERVICEABLE');
  });

  it('supports runApiAction JSON RPC bridge and working-hours keepWarm', () => {
    const rpcRes = env.rpc({ action: 'GET_ALL_DATA' });
    expect(rpcRes.status).toBe('success');
    expect(rpcRes.data.tools.length).toBeGreaterThan(0);
    expect(rpcRes.timing.total).toBeGreaterThanOrEqual(0);

    // Outside working hours (22:00) -> skips warming
    const nightEnv = createGasVm({ mockHour: 22 });
    const skipped = nightEnv.sandbox.keepWarm();
    expect(skipped.skipped).toBe(true);
    expect(nightEnv.state.sheetReads).toBe(0);

    // Inside working hours (10:00) -> warms caches
    const dayEnv = createGasVm({ mockHour: 10 });
    const warmed = dayEnv.sandbox.keepWarm();
    expect(warmed.warmed).toBe(true);
    expect(dayEnv.state.sheetReads).toBe(3);
  });
});
