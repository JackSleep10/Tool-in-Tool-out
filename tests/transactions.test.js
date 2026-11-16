import { describe, it, expect } from 'vitest';
import { normalizeId, computeOutstanding } from '../src/utils/transactions';

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
});
