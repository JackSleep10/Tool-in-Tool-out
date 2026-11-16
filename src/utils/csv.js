import { formatThaiDate, formatThaiTime } from './date';

export const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildReportCsv = ({ rows = [], outstandingIdSet = new Set() }) => {
  const headers = [
    'Date',
    'Time',
    'Tool ID',
    'Tool Name',
    'Employee ID',
    'Employee Name',
    'Staff',
    'Remark',
    'Status'
  ];

  const lines = rows.map((tx) => {
    const isOut = outstandingIdSet.has(tx.id);
    return [
      csvEscape(formatThaiDate(tx.date)),
      csvEscape(formatThaiTime(tx.date)),
      csvEscape(tx.tool_id ?? ''),
      csvEscape(tx.tool_name ?? ''),
      csvEscape(tx.employee_id ?? ''),
      csvEscape(tx.employee_name ?? ''),
      csvEscape(tx.staff_issuer || tx.staff_receiver || '-'),
      csvEscape(String(tx.remark ?? '').trim() || '-'),
      csvEscape(isOut ? 'ยังไม่คืน' : 'คืนแล้ว')
    ].join(',');
  });

  return '\uFEFF' + headers.join(',') + '\n' + lines.join('\n');
};
