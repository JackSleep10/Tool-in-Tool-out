import { describe, it, expect } from 'vitest';
import { matchSearch, isToolUnserviceable, getLocationGroup } from '../src/utils/tools';

describe('tool helpers', () => {
  it('supports multi-token search across fields safely with non-string values', () => {
    const tool = { id: 1001, name: 'Torque Wrench 3/8', location: 'Wall 1 No.5' };
    expect(matchSearch(tool, 'torque wall')).toBe(true);
    expect(matchSearch(tool, '1001 no.5')).toBe(true);
    expect(matchSearch(tool, 'torque hammer')).toBe(false);
    expect(matchSearch(tool, '   ')).toBe(true);
    expect(matchSearch(null, 'torque')).toBe(false);
  });

  it('detects unserviceable statuses consistently', () => {
    expect(isToolUnserviceable({ serviceability_status: 'UNSERVICEABLE' })).toBe(true);
    expect(isToolUnserviceable({ serviceability_status: ' u/s ' })).toBe(true);
    expect(isToolUnserviceable({ status: 'ชำรุด' })).toBe(true);
    expect(isToolUnserviceable({ serviceability_status: 'SERVICEABLE' })).toBe(false);
    expect(isToolUnserviceable(null)).toBe(false);
  });

  it('extracts Wall and GT location groups cleanly for QR batch filtering', () => {
    expect(getLocationGroup('Wall 1 No.12')).toBe('Wall 1');
    expect(getLocationGroup('Wall 3 Socket No.45')).toBe('Wall 3 Socket');
    expect(getLocationGroup('GT5 No.3')).toBe('GT5');
    expect(getLocationGroup('-')).toBe('ไม่ระบุตำแหน่ง');
    expect(getLocationGroup('')).toBe('ไม่ระบุตำแหน่ง');
  });
});
