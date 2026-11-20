import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, it, expect, beforeEach } from 'vitest';

function createGasVm() {
  const state = {
    sheetReads: 0,
    sheetReadsByName: {},
    cellReads: 0,
    lockCalls: 0,
    flushCalls: 0,
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
    getDataRange: () => ({
      getValues: () => {
        state.sheetReads++;
        state.sheetReadsByName[name] = (state.sheetReadsByName[name] || 0) + 1;
        return state.sheets[name].map((r) => r.slice());
      }
    }),
    getRange: (row, col, numRows = 1, numCols = 1) => ({
      getValue: () => {
        state.cellReads++;
        const r = state.sheets[name][row - 1];
        return r ? r[col - 1] : '';
      },
      getValues: () => {
        state.cellReads++;
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const src = state.sheets[name][row - 1 + r] || [];
          const line = [];
          for (let c = 0; c < numCols; c++) {
            line.push(src[col - 1 + c]);
          }
          out.push(line);
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
    Utilities: { getUuid: () => 'uuid-' + uuidCounter++ },
    ContentService: {
      MimeType: { JSON: 'JSON', TEXT: 'TEXT' },
      createTextOutput: (txt) => ({ setMimeType: () => txt })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (state.cacheStore.has(k) ? state.cacheStore.get(k) : null),
        getAll: (keys) => {
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
        },
        remove: (k) => {
          state.cacheStore.delete(k);
        }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => state.propsStore.get(k) ?? null,
        setProperty: (k, v) => { state.propsStore.set(k, String(v)); }
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
  const apiRequest = (action, payload) =>
    JSON.parse(sandbox.apiRequest(action, payload));

  return { state, sandbox, post, get, apiRequest };
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
  });

  it('caches GET_ALL_DATA across UTF-8 chunks and invalidates version on writes', () => {
    env.state.sheetReads = 0;
    const first = env.get({ action: 'GET_ALL_DATA' });
    expect(first.status).toBe('success');
    expect(env.state.sheetReads).toBeGreaterThanOrEqual(3);
    expect(env.state.cacheStore.size).toBeGreaterThan(2);

    env.state.sheetReads = 0;
    const second = env.get({ action: 'GET_ALL_DATA' });
    expect(second.status).toBe('success');
    expect(env.state.sheetReads).toBe(0);
    expect(second.data.tools.length).toBe(first.data.tools.length);

    const verBefore = env.state.propsStore.get('DATA_CACHE_VER');
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
    expect(env.state.propsStore.get('DATA_CACHE_VER')).not.toBe(verBefore);

    // Formula injection sanitized while plain '-' preserved
    const appendedRow = env.state.sheets.Transactions[env.state.sheets.Transactions.length - 1];
    expect(appendedRow[9]).toBe('-');
    expect(appendedRow[11]).toBe("'=SUM(1,1)");

    env.state.sheetReads = 0;
    env.get({ action: 'GET_ALL_DATA' });
    expect(env.state.sheetReads).toBeGreaterThanOrEqual(3);
  });

  it('blocks duplicate BORROW and UNSERVICEABLE tools under lock, while allowing RETURN-then-BORROW in one batch', () => {
    // T-01 is initially borrowed by EMP-01 (B-OLD)
    const dup = env.post({
      action: 'BORROW',
      tool_id: ' t-01 ',
      tool_name: 'Wrench',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(dup.status).toBe('error');

    const us = env.post({
      action: 'BORROW',
      tool_id: 'T-02',
      tool_name: 'Broken Drill',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(us.status).toBe('error');

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
    expect(env.state.lockCalls).toBe(3);
    expect(env.state.flushCalls).toBe(1); // Only successful write flushes
  });

  it('marks tools UNSERVICEABLE and restores SERVICEABLE', () => {
    const res1 = env.post({
      action: 'MARK_UNSERVICEABLE',
      tool_id: 'T-01',
      reason: 'Cracked handle',
      marked_by: 'Admin'
    });
    expect(res1.status).toBe('success');
    expect(env.state.sheets.Tools[1][3]).toBe('UNSERVICEABLE');
    expect(env.state.sheets.Tools[1][4]).toBe('Cracked handle');

    const res2 = env.post({ action: 'MARK_SERVICEABLE', tool_id: 'T-01' });
    expect(res2.status).toBe('success');
    expect(env.state.sheets.Tools[1][3]).toBe('SERVICEABLE');
    expect(env.state.sheets.Tools[1][4]).toBe('');
  });

  it('uses O(1) guard caches for BORROW after warm GET_ALL_DATA and returns canonical transactions', () => {
    env.get({ action: 'GET_ALL_DATA' });
    env.state.sheetReads = 0;
    env.state.cellReads = 0;

    const borrowRes = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'BORROW',
        tool_id: 'T-BULK-0',
        tool_name: 'Bulk Tool 0',
        employee_id: 'EMP-01',
        employee_name: 'Somchai',
        staff_issuer: 'Staff'
      }]
    });
    expect(borrowRes.status).toBe('success');
    expect(borrowRes.data.transactions).toHaveLength(1);
    expect(borrowRes.data.transactions[0].id).toBe(borrowRes.data.ids[0]);
    expect(Number.isNaN(Date.parse(borrowRes.data.transactions[0].date))).toBe(false);
    expect(env.state.sheetReads).toBe(0);
    expect(env.state.cellReads).toBe(1);

    // Duplicate borrow and U/S borrow are also blocked without full-sheet reads
    env.state.sheetReads = 0;
    const dupRes = env.post({
      action: 'BORROW',
      tool_id: ' t-bulk-0 ',
      tool_name: 'Bulk Tool 0',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(dupRes.status).toBe('error');
    expect(env.state.sheetReads).toBe(0);

    const usRes = env.post({
      action: 'BORROW',
      tool_id: 'T-02',
      tool_name: 'Broken Drill',
      employee_id: 'EMP-02',
      employee_name: 'Suda'
    });
    expect(usRes.status).toBe('error');
    expect(env.state.sheetReads).toBe(0);
  });

  it('detects manual sheet edits via watermark and falls back to full Transactions read', () => {
    env.get({ action: 'GET_ALL_DATA' });

    // Simulate someone manually inserting a row directly in Google Sheets
    env.state.sheets.Transactions.push([
      'MANUAL-B1',
      new Date().toISOString(),
      'BORROW',
      'T-BULK-1',
      'Bulk Tool 1',
      'EMP-01',
      'Somchai',
      1,
      'Manual',
      '-',
      '-',
      '-'
    ]);

    env.state.sheetReads = 0;
    const dupRes = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'BORROW',
        tool_id: 'T-BULK-1',
        tool_name: 'Bulk Tool 1',
        employee_id: 'EMP-02',
        employee_name: 'Suda'
      }]
    });
    expect(dupRes.status).toBe('error');
    expect(dupRes.message).toContain('ถูกยืมอยู่แล้ว');
    expect(env.state.sheetReads).toBeGreaterThanOrEqual(1);
  });

  it('skips Tools sheet on RETURN-only batch and keeps guard cache warm for subsequent BORROW', () => {
    env.state.sheetReadsByName = {};
    const coldReturn = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'RETURN',
        tool_id: 'T-01',
        tool_name: 'Wrench',
        employee_id: 'EMP-01',
        employee_name: 'Somchai',
        linked_borrow_id: 'B-OLD'
      }]
    });
    expect(coldReturn.status).toBe('success');
    expect(env.state.sheetReadsByName.Tools || 0).toBe(0);

    // Warm via GET_ALL_DATA, borrow -> return -> re-borrow with 0 full-sheet reads
    env.get({ action: 'GET_ALL_DATA' });
    env.state.sheetReads = 0;
    const b1 = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'BORROW',
        tool_id: 'T-BULK-2',
        tool_name: 'Bulk Tool 2',
        employee_id: 'EMP-01',
        employee_name: 'Somchai'
      }]
    });
    expect(b1.status).toBe('success');
    expect(env.state.sheetReads).toBe(0);

    const ret = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'RETURN',
        tool_id: 'T-BULK-2',
        tool_name: 'Bulk Tool 2',
        employee_id: 'EMP-01',
        employee_name: 'Somchai',
        linked_borrow_id: b1.data.ids[0]
      }]
    });
    expect(ret.status).toBe('success');
    expect(env.state.sheetReads).toBe(0);

    const b2 = env.post({
      action: 'BATCH_TRANSACTIONS',
      transactions: [{
        action: 'BORROW',
        tool_id: 'T-BULK-2',
        tool_name: 'Bulk Tool 2',
        employee_id: 'EMP-02',
        employee_name: 'Suda'
      }]
    });
    expect(b2.status).toBe('success');
    expect(env.state.sheetReads).toBe(0);
  });

  it('invalidates TOOLS_CACHE_VER only on serviceability changes and returns canonical tool fields', () => {
    env.get({ action: 'GET_ALL_DATA' });
    const toolsVerBefore = env.state.propsStore.get('TOOLS_CACHE_VER');

    const b1 = env.post({
      action: 'BORROW',
      tool_id: 'T-BULK-3',
      tool_name: 'Bulk Tool 3',
      employee_id: 'EMP-01',
      employee_name: 'Somchai'
    });
    expect(b1.status).toBe('success');
    expect(b1.data.transaction.id).toBe(b1.data.id);
    expect(env.state.propsStore.get('TOOLS_CACHE_VER')).toBe(toolsVerBefore);

    const markRes = env.post({
      action: 'MARK_UNSERVICEABLE',
      tool_id: 'T-BULK-4',
      reason: 'Broken switch',
      marked_by: 'Tester'
    });
    expect(markRes.status).toBe('success');
    expect(markRes.data.serviceability_status).toBe('UNSERVICEABLE');
    expect(markRes.data.unserviceable_reason).toBe('Broken switch');
    expect(env.state.propsStore.get('TOOLS_CACHE_VER')).not.toBe(toolsVerBefore);

    const borrowUs = env.post({
      action: 'BORROW',
      tool_id: 'T-BULK-4',
      tool_name: 'Bulk Tool 4',
      employee_id: 'EMP-01',
      employee_name: 'Somchai'
    });
    expect(borrowUs.status).toBe('error');
    expect(borrowUs.message).toContain('ชำรุด');
  });

  it('supports direct apiRequest() RPC and caches full_history exceeding 80 chunks', () => {
    const rpcAll = env.apiRequest('GET_ALL_DATA', {});
    expect(rpcAll.status).toBe('success');
    expect(rpcAll.data.tools.length).toBeGreaterThan(0);

    const rpcBorrow = env.apiRequest('BATCH_TRANSACTIONS', {
      transactions: [{
        action: 'BORROW',
        tool_id: 'T-BULK-5',
        tool_name: 'Bulk Tool 5',
        employee_id: 'EMP-02',
        employee_name: 'Suda'
      }]
    });
    expect(rpcBorrow.status).toBe('success');
    expect(rpcBorrow.data.transactions[0].tool_id).toBe('T-BULK-5');

    // Expand Transactions to exceed 2.4M chars (> 80 chunks of 30,000 chars)
    const bigText = 'x'.repeat(2500);
    for (let i = 0; i < 1000; i++) {
      env.state.sheets.Transactions.push([
        `H-${i}`,
        '2025-01-01T00:00:00Z',
        'RETURN',
        'T-BULK-6',
        'Tool',
        'EMP-01',
        'Somchai',
        1,
        'Staff',
        'Staff',
        '-',
        bigText
      ]);
    }

    env.state.sheetReads = 0;
    const full1 = env.apiRequest('GET_FULL_HISTORY', {});
    expect(full1.status).toBe('success');
    expect(full1.data.transactions.length).toBeGreaterThan(1000);
    expect(env.state.sheetReads).toBe(1);

    env.state.sheetReads = 0;
    const full2 = env.apiRequest('GET_FULL_HISTORY', {});
    expect(full2.status).toBe('success');
    expect(full2.data.transactions.length).toBe(full1.data.transactions.length);
    expect(env.state.sheetReads).toBe(0);
  });
});
