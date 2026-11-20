import { describe, it, expect } from 'vitest';
import { normalizeId, computeOutstanding, mergeRecentTransactions } from '../src/utils/transactions';

describe('transactions & outstanding replay', () => {
  it('normalizes IDs by trimming and lowercasing regardless of type', () => {
    expect(normalizeId(' TLR-001 ')).toBe('tlr-001');
    expect(normalizeId(12345)).toBe('12345');
    expect(normalizeId(null)).toBe('');
    expect(normalizeId(undefined)).toBe('');
  });

  it('matches RETURN by linked_borrow_id before FIFO fallback', () => {
    const txs = [
      { id: 'B1', date: '2026-01-01T08:00:00Z', action: 'BORROW', tool_id: 'T1', employee_id: 'E1' },
      { id: 'B2', date: '2026-01-01T09:00:00Z', action: 'BORROW', tool_id: 'T1', employee_id: 'E1' },
      { id: 'R1', date: '2026-01-01T10:00:00Z', action: 'RETURN', tool_id: 'T1', employee_id: 'E1', linked_borrow_id: 'B2' }
    ];
    const { outstandingList, returnToBorrowMap } = computeOutstanding(txs);
    expect(returnToBorrowMap).toEqual({ R1: 'B2' });
    expect(outstandingList.map((t) => t.id)).toEqual(['B1']);
  });

  it('falls back to FIFO by normalized (tool_id, employee_id) even if array is out of chronological order', () => {
    const txs = [
      { id: 'R1', date: '2026-01-02T10:00:00Z', action: 'RETURN', tool_id: 't-1 ', employee_id: ' e-1', linked_borrow_id: '-' },
      { id: 'B2', date: '2026-01-02T09:00:00Z', action: 'BORROW', tool_id: 'T-1', employee_id: 'E-1' },
      { id: 'B1', date: '2026-01-01T09:00:00Z', action: 'BORROW', tool_id: 'T-1', employee_id: 'E-1' }
    ];
    const { outstandingList, returnToBorrowMap } = computeOutstanding(txs);
    expect(returnToBorrowMap).toEqual({ R1: 'B1' });
    expect(outstandingList.map((t) => t.id)).toEqual(['B2']);
  });

  it('ignores orphan RETURN records gracefully', () => {
    const txs = [
      { id: 'R-ORPHAN', date: '2026-01-02T10:00:00Z', action: 'RETURN', tool_id: 'T-99', employee_id: 'E-99', linked_borrow_id: '-' }
    ];
    const { outstandingList, returnToBorrowMap } = computeOutstanding(txs);
    expect(outstandingList).toEqual([]);
    expect(returnToBorrowMap).toEqual({});
  });

  it('merges recent transactions with older full history without duplicates or temp records', () => {
    const cutoffMs = Date.parse('2026-10-20T00:00:00Z');
    const existingFull = [
      { id: 'B-OLD-CLOSED', date: '2026-08-01T08:00:00Z', action: 'BORROW', tool_id: 'T-1', employee_id: 'E-1' },
      { id: 'R-OLD-CLOSED', date: '2026-08-01T10:00:00Z', action: 'RETURN', tool_id: 'T-1', employee_id: 'E-1', linked_borrow_id: 'B-OLD-CLOSED' },
      { id: 'B-OLD-STILL-OUT', date: '2026-09-15T08:00:00Z', action: 'BORROW', tool_id: 'T-2', employee_id: 'E-1' },
      { id: 'B-RECENT-OLD', date: '2026-11-01T08:00:00Z', action: 'BORROW', tool_id: 'T-3', employee_id: 'E-1' },
      { id: 'temp_123_0', date: '2026-11-19T08:00:00Z', action: 'BORROW', tool_id: 'T-4', employee_id: 'E-2' }
    ];
    const incomingRecent = [
      { id: 'B-OLD-STILL-OUT', date: '2026-09-15T08:00:00Z', action: 'BORROW', tool_id: 'T-2', employee_id: 'E-1' },
      { id: 'R-NOW', date: '2026-11-19T09:00:00Z', action: 'RETURN', tool_id: 'T-2', employee_id: 'E-1', linked_borrow_id: 'B-OLD-STILL-OUT' },
      { id: 'B-RECENT-OLD', date: '2026-11-01T08:00:00Z', action: 'BORROW', tool_id: 'T-3', employee_id: 'E-1' },
      { id: 'REAL-UUID-4', date: '2026-11-19T08:00:00Z', action: 'BORROW', tool_id: 'T-4', employee_id: 'E-2' }
    ];

    const merged = mergeRecentTransactions(existingFull, incomingRecent, cutoffMs);
    expect(merged.map((t) => t.id)).toEqual([
      'B-OLD-CLOSED',
      'R-OLD-CLOSED',
      'B-OLD-STILL-OUT',
      'R-NOW',
      'B-RECENT-OLD',
      'REAL-UUID-4'
    ]);
  });
});
