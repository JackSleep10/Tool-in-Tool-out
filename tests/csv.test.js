import { describe, it, expect } from 'vitest';
import { csvEscape, buildReportCsv } from '../src/utils/csv';

describe('CSV export helper (RFC-4180)', () => {
  it('escapes embedded quotes, commas, and newlines', () => {
    expect(csvEscape('Wrench "10mm", Heavy\nDuty')).toBe('"Wrench ""10mm"", Heavy\nDuty"');
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(42)).toBe('"42"');
  });

  it('prepends UTF-8 BOM and exports all columns with Thai status', () => {
    const csv = buildReportCsv({
      rows: [
        {
          id: 'tx-1',
          date: '2026-03-11T02:15:00.000Z',
          tool_id: 'T-01',
          tool_name: 'Socket "1/2"',
          employee_id: 'EMP-1',
          employee_name: 'Somchai',
          staff_issuer: 'Admin',
          remark: 'Line, 1'
        }
      ],
      outstandingIdSet: new Set(['tx-1'])
    });

    expect(csv.startsWith('\uFEFFDate,Time,Tool ID,Tool Name,Employee ID,Employee Name,Staff,Remark,Status\n')).toBe(true);
    expect(csv).toContain('"T-01","Socket ""1/2""","EMP-1","Somchai","Admin","Line, 1","ยังไม่คืน"');
  });
});
