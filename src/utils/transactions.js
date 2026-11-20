export function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase();
}

/**
 * Replay transactions chronologically and compute currently unreturned borrows.
 * Matches RETURN -> BORROW by linked_borrow_id first, then falls back to FIFO
 * by normalized (tool_id, employee_id).
 */
export function computeOutstanding(transactions) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { outstandingList: [], returnToBorrowMap: {} };
  }

  const sorted = [...transactions].sort((a, b) => {
    const ta = new Date(a?.date).getTime();
    const tb = new Date(b?.date).getTime();
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
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
        idx = outstandingList.findIndex((item) => {
          const itemId = normalizeId(item.id);
          return itemId !== '' && itemId === linkedId;
        });
      }

      if (idx === -1) {
        const toolId = normalizeId(tx.tool_id);
        const empId = normalizeId(tx.employee_id);
        idx = outstandingList.findIndex(
          (item) => normalizeId(item.tool_id) === toolId && normalizeId(item.employee_id) === empId
        );
      }

      if (idx !== -1) {
        const [matchedBorrow] = outstandingList.splice(idx, 1);
        if (tx.id && matchedBorrow.id) {
          returnToBorrowMap[tx.id] = matchedBorrow.id;
        }
      }
    }
  }

  return { outstandingList, returnToBorrowMap };
}

/**
 * Merge a fresh recent/outstanding transaction slice into an already-loaded full history
 * without dropping records older than 30 days or duplicating matching IDs.
 */
export function mergeRecentTransactions(
  existingTxs,
  incomingRecentTxs,
  cutoffMs = Date.now() - 30 * 24 * 60 * 60 * 1000
) {
  const existing = Array.isArray(existingTxs) ? existingTxs : [];
  const incoming = Array.isArray(incomingRecentTxs) ? incomingRecentTxs : [];

  const incomingIds = new Set();
  for (let i = 0; i < incoming.length; i++) {
    const key = normalizeId(incoming[i]?.id);
    if (key) incomingIds.add(key);
  }

  const seenOlderIds = new Set();
  const preservedOlder = [];
  for (let i = 0; i < existing.length; i++) {
    const tx = existing[i];
    if (!tx) continue;
    const rawId = String(tx.id ?? '');
    if (rawId.startsWith('temp_')) continue;

    const idKey = normalizeId(rawId);
    if (idKey && (incomingIds.has(idKey) || seenOlderIds.has(idKey))) continue;

    const ts = tx.date ? new Date(tx.date).getTime() : NaN;
    if (!Number.isNaN(ts) && ts < cutoffMs) {
      if (idKey) seenOlderIds.add(idKey);
      preservedOlder.push(tx);
    }
  }

  return [...preservedOlder, ...incoming];
}
