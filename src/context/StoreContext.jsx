import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { fetchFromSheet } from '../services/api';
import { getTodayDateKey, toBangkokDateKey } from '../utils/date';
import { computeOutstanding, normalizeId } from '../utils/transactions';

const StoreContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useStore = () => useContext(StoreContext);

export const StoreProvider = ({ children }) => {
    // 1. Initial State from LocalStorage Cache (Instant render in < 50ms)
    const [employees, setEmployees] = useState(() => {
        try {
            const cached = localStorage.getItem('gse_cache_employees');
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    });

    const [tools, setTools] = useState(() => {
        try {
            const cached = localStorage.getItem('gse_cache_tools');
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    });

    const [transactions, setTransactions] = useState(() => {
        try {
            const cached = localStorage.getItem('gse_cache_transactions');
            return cached ? JSON.parse(cached) : [];
        } catch (e) {
            return [];
        }
    });

    // If cache already has tools & employees, loading starts as false
    const [loading, setLoading] = useState(() => {
        try {
            const hasTools = !!localStorage.getItem('gse_cache_tools');
            const hasEmployees = !!localStorage.getItem('gse_cache_employees');
            return !(hasTools && hasEmployees);
        } catch (e) {
            return true;
        }
    });

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hasFullHistory, setHasFullHistory] = useState(false);
    const hasFullHistoryRef = useRef(false);
    const pendingMutationsRef = useRef(0);
    const [lastSyncTime, setLastSyncTime] = useState(() => {
        try {
            return localStorage.getItem('gse_cache_timestamp') || null;
        } catch (e) {
            return null;
        }
    });
    const lastSyncTimeRef = useRef(lastSyncTime);

    const cacheRecentTransactions = useCallback((txList, outstandingList) => {
        try {
            const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const outIds = new Set((outstandingList || []).map(item => item.id).filter(Boolean));
            const recent = (txList || []).filter(tx => {
                if (tx?.id && outIds.has(tx.id)) return true;
                const ts = tx?.date ? new Date(tx.date).getTime() : NaN;
                return !Number.isNaN(ts) && ts >= cutoff;
            });
            localStorage.setItem('gse_cache_transactions', JSON.stringify(recent));
        } catch (cacheErr) {
            console.warn('LocalStorage transaction cache error:', cacheErr);
        }
    }, []);

    const loadData = useCallback(async (silent = false) => {
        // M2: avoid overwriting optimistic state while a write mutation is in flight
        if (silent && pendingMutationsRef.current > 0) return;

        if (!silent) {
            setLoading(true);
        }
        setIsRefreshing(true);
        try {
            const includeFull = hasFullHistoryRef.current;
            const result = await fetchFromSheet('GET_ALL_DATA', includeFull ? { full_history: true } : {});
            if (silent && pendingMutationsRef.current > 0) return;

            if (result && result.status === 'success') {
                const data = result.data;
                const newEmps = data.employees || [];
                const newTools = data.tools || [];
                const newTxs = data.transactions || [];

                setEmployees(newEmps);
                setTools(newTools);
                setTransactions(newTxs);
                const fullFlag = !!data.has_full_history;
                hasFullHistoryRef.current = fullFlag;
                setHasFullHistory(fullFlag);
                const now = Date.now().toString();
                lastSyncTimeRef.current = now;
                setLastSyncTime(now);

                // Update LocalStorage cache (M10: keep transactions cached to 30-day + outstanding slice)
                try {
                    localStorage.setItem('gse_cache_employees', JSON.stringify(newEmps));
                    localStorage.setItem('gse_cache_tools', JSON.stringify(newTools));
                    localStorage.setItem('gse_cache_timestamp', now);
                } catch (cacheErr) {
                    console.warn('LocalStorage save error (quota exceeded):', cacheErr);
                }
                if (fullFlag) {
                    const { outstandingList } = computeOutstanding(newTxs);
                    cacheRecentTransactions(newTxs, outstandingList);
                } else {
                    try {
                        localStorage.setItem('gse_cache_transactions', JSON.stringify(newTxs));
                    } catch (cacheErr) {
                        console.warn('LocalStorage transaction cache error:', cacheErr);
                    }
                }
            } else {
                console.error('Failed to load data:', result);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [cacheRecentTransactions]);

    // Initial Data Load (Background update)
    useEffect(() => {
        loadData(true);
    }, [loadData]);

    // Auto-refresh every 30s only when tab is visible, and sync immediately when returning to tab
    useEffect(() => {
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            loadData(true);
        }, 30000);

        const handleVisibilityChange = () => {
            if (typeof document === 'undefined' || document.hidden) return;
            const last = Number(lastSyncTimeRef.current || 0);
            if (Date.now() - last >= 15000) {
                loadData(true);
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }
        return () => {
            clearInterval(interval);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
    }, [loadData]);

    const fetchFullHistory = async () => {
        if (hasFullHistoryRef.current) return;
        setIsRefreshing(true);
        try {
            const result = await fetchFromSheet('GET_FULL_HISTORY');
            if (result && result.status === 'success') {
                const fullTxs = result.data.transactions || [];
                setTransactions(fullTxs);
                hasFullHistoryRef.current = true;
                setHasFullHistory(true);
                // M10: keep localStorage bounded to 30-day + outstanding slice
                const { outstandingList } = computeOutstanding(fullTxs);
                cacheRecentTransactions(fullTxs, outstandingList);
            }
        } catch (error) {
            console.error('Error fetching full history:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const realOutstanding = useMemo(() => {
        const { outstandingList } = computeOutstanding(transactions);
        return [...outstandingList].reverse();
    }, [transactions]);

    // M7: O(1) lookup maps for tools and currently-out tools
    const toolsByIdMap = useMemo(() => {
        const map = new Map();
        for (const tool of tools) {
            const key = normalizeId(tool?.id);
            if (key && !map.has(key)) {
                map.set(key, tool);
            }
        }
        return map;
    }, [tools]);

    const outstandingByToolIdMap = useMemo(() => {
        const map = new Map();
        for (const tx of realOutstanding) {
            const key = normalizeId(tx?.tool_id);
            if (key && !map.has(key)) {
                map.set(key, tx);
            }
        }
        return map;
    }, [realOutstanding]);

    // Helper: Is this specific physical tool currently borrowed by ANYONE?
    const isToolCurrentlyOut = (toolId) => {
        const target = normalizeId(toolId);
        return target !== '' && outstandingByToolIdMap.has(target);
    };

    // Helper: Who has this tool? (optional metadata)
    const getToolBorrower = (toolId) => {
        const target = normalizeId(toolId);
        return target ? outstandingByToolIdMap.get(target) : undefined;
    };

    // Actions
    const addTransaction = async (transactionData) => {
        const tempId = `temp_${Date.now()}`;
        const optimisticTx = {
            ...transactionData,
            id: tempId,
            date: new Date().toISOString(),
            status: 'PENDING_SERVER'
        };

        pendingMutationsRef.current += 1;
        let released = false;
        const releaseMutation = () => {
            if (!released) {
                released = true;
                pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
            }
        };

        setTransactions(prev => [...prev, optimisticTx]);

        try {
            const result = await fetchFromSheet(transactionData.action, transactionData);
            releaseMutation();
            await loadData(true);
            return result.data;
        } catch (e) {
            setTransactions(prev => prev.filter(tx => tx.id !== tempId));
            console.error('Network Error', e);
            throw e;
        } finally {
            releaseMutation();
        }
    };

    const addBatchTransactions = async (transactionsArray) => {
        if (!transactionsArray || transactionsArray.length === 0) return null;

        const now = new Date().toISOString();
        const batchNonce = Date.now();
        const tempIds = new Set();
        const optimisticTxs = transactionsArray.map((tx, index) => {
            const tempId = `temp_${batchNonce}_${index}`;
            tempIds.add(tempId);
            return {
                ...tx,
                id: tempId,
                date: now,
                status: 'PENDING_SERVER'
            };
        });

        pendingMutationsRef.current += 1;
        let released = false;
        const releaseMutation = () => {
            if (!released) {
                released = true;
                pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
            }
        };

        setTransactions(prev => [...prev, ...optimisticTxs]);

        try {
            const result = await fetchFromSheet('BATCH_TRANSACTIONS', {
                transactions: transactionsArray
            });
            releaseMutation();
            await loadData(true);
            return result.data;
        } catch (e) {
            setTransactions(prev => prev.filter(tx => !tempIds.has(tx.id)));
            console.error('Batch Network Error', e);
            throw e;
        } finally {
            releaseMutation();
        }
    };

    const markUnserviceable = async (toolId, reason, markedBy) => {
        let previousTool = null;
        const targetId = normalizeId(toolId);

        pendingMutationsRef.current += 1;
        let released = false;
        const releaseMutation = () => {
            if (!released) {
                released = true;
                pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
            }
        };

        setTools(prev => prev.map(t => {
            if (targetId && normalizeId(t.id) === targetId) {
                previousTool = t;
                return {
                    ...t,
                    serviceability_status: 'UNSERVICEABLE',
                    unserviceable_reason: reason,
                    unserviceable_date: new Date().toISOString(),
                    unserviceable_by: markedBy
                };
            }
            return t;
        }));

        try {
            const result = await fetchFromSheet('MARK_UNSERVICEABLE', {
                tool_id: toolId,
                reason: reason,
                marked_by: markedBy
            });
            releaseMutation();
            await loadData(true);
            return result.data;
        } catch (e) {
            if (previousTool) {
                setTools(prev => prev.map(t => (t.id === previousTool.id ? previousTool : t)));
            }
            console.error('Error marking unserviceable:', e);
            throw e;
        } finally {
            releaseMutation();
        }
    };

    const markServiceable = async (toolId) => {
        let previousTool = null;
        const targetId = normalizeId(toolId);

        pendingMutationsRef.current += 1;
        let released = false;
        const releaseMutation = () => {
            if (!released) {
                released = true;
                pendingMutationsRef.current = Math.max(0, pendingMutationsRef.current - 1);
            }
        };

        setTools(prev => prev.map(t => {
            if (targetId && normalizeId(t.id) === targetId) {
                previousTool = t;
                return {
                    ...t,
                    serviceability_status: 'SERVICEABLE',
                    unserviceable_reason: '',
                    unserviceable_date: '',
                    unserviceable_by: ''
                };
            }
            return t;
        }));

        try {
            const result = await fetchFromSheet('MARK_SERVICEABLE', {
                tool_id: toolId
            });
            releaseMutation();
            await loadData(true);
            return result.data;
        } catch (e) {
            if (previousTool) {
                setTools(prev => prev.map(t => (t.id === previousTool.id ? previousTool : t)));
            }
            console.error('Error marking serviceable:', e);
            throw e;
        } finally {
            releaseMutation();
        }
    };

    const getStats = () => {
        if (loading && !tools.length) return { borrowedToday: 0, returnedToday: 0, outstanding: 0, unserviceable: 0 };
        const today = getTodayDateKey();
        const todayTx = transactions.filter(t => toBangkokDateKey(t?.date) === today);

        const unserviceableCount = tools.filter(t =>
            String(t.serviceability_status ?? '').toUpperCase() === 'UNSERVICEABLE'
        ).length;

        return {
            borrowedToday: todayTx.filter(t => t.action === 'BORROW').length,
            returnedToday: todayTx.filter(t => t.action === 'RETURN').length,
            outstanding: realOutstanding.length,
            unserviceable: unserviceableCount
        };
    };

    return (
        <StoreContext.Provider value={{
            loading,
            isRefreshing,
            hasFullHistory,
            lastSyncTime,
            employees,
            tools,
            toolsByIdMap,
            transactions,
            outstandingTransactions: realOutstanding,
            addTransaction,
            addBatchTransactions,
            markUnserviceable,
            markServiceable,
            getStats,
            isToolCurrentlyOut,
            getToolBorrower,
            fetchFullHistory,
            refreshData: () => loadData(false),
            silentRefresh: () => loadData(true)
        }}>
            {children}
        </StoreContext.Provider>
    );
};
