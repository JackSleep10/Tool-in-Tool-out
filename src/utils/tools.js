/**
 * Shared helpers for searching and classifying tools.
 */

export const matchSearch = (item, searchStr, fields = ['name', 'id', 'location']) => {
  if (!item) return false;
  if (!searchStr || !String(searchStr).trim()) return true;
  const tokens = String(searchStr).trim().toLowerCase().split(/\s+/);
  const text = fields.map((f) => String(item[f] ?? '').toLowerCase()).join(' ');
  return tokens.every((token) => text.includes(token));
};

export const isToolUnserviceable = (tool) => {
  if (!tool) return false;
  const status = String(tool.serviceability_status || tool.status || '').trim().toUpperCase();
  return (
    status === 'UNSERVICEABLE' ||
    status === 'U/S' ||
    status.includes('UNSERVICE') ||
    status.includes('ชำรุด')
  );
};

export const getLocationGroup = (location) => {
  const raw = String(location ?? '').trim();
  if (!raw || raw === '-') return 'ไม่ระบุตำแหน่ง';
  const noMatch = raw.match(/^(.*?)\s+No\.\s*\d+/i);
  if (noMatch && noMatch[1]) return noMatch[1].trim();
  const prefixMatch = raw.match(/^(Wall\s+\d+(?:\s+Socket)?|GT\s*\d+)/i);
  if (prefixMatch) return prefixMatch[1].trim();
  return raw;
};
