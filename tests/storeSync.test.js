import { describe, it, expect } from 'vitest';
import {
  shouldApplySyncResponse,
  reconcileCommittedTransactions,
  reconcileCommittedTool
} from '../src/utils/storeSync';

describe('storeSync reconciliation & stale-response guards', () => {
  it('discards silent sync responses when a mutation is in flight or epoch advanced', () => {
    expect(shouldApplySyncResponse({
      silent: true,
      pendingMutations: 1,
      requestEpoch: 3,
      currentEpoch: 3
    })).toBe(false);

    expect(shouldApplySyncResponse({
      silent: true,
      pendingMutations: 0,
      requestEpoch: 2,
      currentEpoch: 3
    })).toBe(false);

    expect(shouldApplySyncResponse({
      silent: true,
      pendingMutations: 0,
      requestEpoch: 3,
      currentEpoch: 3
    })).toBe(true);

    // Non-silent manual refresh always applies
    expect(shouldApplySyncResponse({
      silent: false,
      pendingMutations: 1,
      requestEpoch: 1,
      currentEpoch: 5
    })).toBe(true);
  });

  it('replaces temp_* optimistic rows with authoritative server records', () => {
    const prev = [
      { id: 'B-1', action: 'BORROW', tool_id: 'T-01' },
      { id: 'temp_100_0', action: 'RETURN', tool_id: 'T-01', status: 'PENDING_SERVER' }
    ];

    const next = reconcileCommittedTransactions(prev, ['temp_100_0'], {
      ids: ['uuid-99'],
      records: [
        { id: 'uuid-99', date: '2026-11-18T10:00:00.000Z', action: 'RETURN', tool_id: 'T-01' }
      ]
    });

    expect(next).toHaveLength(2);
    expect(next.some(tx => tx.id === 'temp_100_0')).toBe(false);
    expect(next[1]).toEqual({
      id: 'uuid-99',
      date: '2026-11-18T10:00:00.000Z',
      action: 'RETURN',
      tool_id: 'T-01'
    });
  });

  it('falls back to patching temp_* IDs and clearing PENDING_SERVER for legacy backends', () => {
    const prev = [
      { id: 'temp_200_0', action: 'BORROW', tool_id: 'T-05', status: 'PENDING_SERVER' }
    ];

    const next = reconcileCommittedTransactions(prev, ['temp_200_0'], {
      ids: ['uuid-55']
    });

    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('uuid-55');
    expect(next[0].status).toBeUndefined();
  });

  it('applies authoritative tool_patch by normalized tool_id', () => {
    const prevTools = [
      { id: 'T-01', name: 'Wrench', serviceability_status: 'SERVICEABLE' },
      { id: 'T-02', name: 'Drill', serviceability_status: 'SERVICEABLE' }
    ];

    const next = reconcileCommittedTool(prevTools, ' t-01 ', {
      serviceability_status: 'UNSERVICEABLE',
      unserviceable_reason: 'Broken',
      unserviceable_date: '2026-11-18T10:00:00.000Z',
      unserviceable_by: 'Admin'
    });

    expect(next[0].serviceability_status).toBe('UNSERVICEABLE');
    expect(next[0].unserviceable_reason).toBe('Broken');
    expect(next[1].serviceability_status).toBe('SERVICEABLE');
  });
});
