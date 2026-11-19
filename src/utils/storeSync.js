import { normalizeId } from './transactions';

/**
 * Determine whether a background loadData response should be applied.
 * Discards responses if a mutation is currently in flight or if a newer
 * mutation/commit occurred after the request was started.
 */
export function shouldApplySyncResponse({ silent, pendingMutations, requestEpoch, currentEpoch }) {
    if (!silent) return true;
    if (pendingMutations > 0) return false;
    return requestEpoch === currentEpoch;
}

/**
 * Replace optimistic temp_* transactions with authoritative server records
 * (or fallback to patching real IDs if a legacy backend omits full records).
 */
export function reconcileCommittedTransactions(prevTransactions, tempIds, serverData) {
    const tempIdList = Array.isArray(tempIds) ? tempIds : Array.from(tempIds || []);
    const tempIdSet = new Set(tempIdList);

    const serverRecords = Array.isArray(serverData?.records) && serverData.records.length > 0
        ? serverData.records
        : (serverData?.record ? [serverData.record] : null);

    if (serverRecords) {
        const withoutTemp = prevTransactions.filter(tx => !tempIdSet.has(tx?.id));
        const existingIds = new Set(withoutTemp.map(tx => tx?.id).filter(Boolean));
        const toAppend = serverRecords.filter(rec => !rec?.id || !existingIds.has(rec.id));
        return [...withoutTemp, ...toAppend];
    }

    const serverIds = Array.isArray(serverData?.ids)
        ? serverData.ids
        : (serverData?.id ? [serverData.id] : []);

    const idByTemp = new Map();
    tempIdList.forEach((tempId, index) => {
        if (serverIds[index]) {
            idByTemp.set(tempId, serverIds[index]);
        }
    });

    return prevTransactions.map(tx => {
        if (!tempIdSet.has(tx?.id)) return tx;
        const realId = idByTemp.get(tx.id) || tx.id;
        const nextTx = { ...tx, id: realId };
        delete nextTx.status;
        return nextTx;
    });
}

/**
 * Apply authoritative server tool_patch after MARK_UNSERVICEABLE / MARK_SERVICEABLE.
 */
export function reconcileCommittedTool(prevTools, toolId, toolPatch) {
    if (!toolPatch) return prevTools;
    const targetId = normalizeId(toolId);
    if (!targetId) return prevTools;
    return prevTools.map(t => (normalizeId(t?.id) === targetId ? { ...t, ...toolPatch } : t));
}
