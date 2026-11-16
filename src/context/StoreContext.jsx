import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { fetchFromSheet } from '../services/api';
import { getTodayDateKey, toBangkokDateKey } from '../utils/date';
import { computeOutstanding, normalizeId } from '../utils/transactions';

const StoreContext = createContext();

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
    const [lastSyncTime, setLastSyncTime] = useState(() => {
        try {
            return localStorage.getItem('gse_cache_timestamp') || null;
        } catch (e) {
            return null;
        }
    });

    // Initial Data Load (Background update)
    useEffect(() => {
        loadData(true);
    }, []);

    // Auto-refresh data every 30 seconds silently in the background
    useEffect(() => {
        const interval = setInterval(() => {
            loadData(true);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }
        setIsRefreshing(true);
        try {
            const includeFull = hasFullHistoryRef.current;
            const result = await fetchFromSheet('GET_ALL_DATA', includeFull ? { full_history: true } : {});
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
                setLastSyncTime(now);

                // Update LocalStorage cache
                try {
                    localStorage.setItem('gse_cache_employees', JSON.stringify(newEmps));
                    localStorage.setItem('gse_cache_tools', JSON.stringify(newTools));
                    localStorage.setItem('gse_cache_transactions', JSON.stringify(newTxs));
                    localStorage.setItem('gse_cache_timestamp', now);
                } catch (cacheErr) {
                    console.warn('LocalStorage save error (quota exceeded):', cacheErr);
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
    };

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
                try {
                    localStorage.setItem('gse_cache_transactions', JSON.stringify(fullTxs));
                } catch (e) {
                    console.warn('Could not cache full history:', e);
                }
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

    // Helper: Is this specific physical tool currently borrowed by ANYONE?
    const isToolCurrentlyOut = (toolId) => {
        const target = normalizeId(toolId);
        return target !== '' && realOutstanding.some(tx => normalizeId(tx.tool_id) === target);
    };

    // Helper: Who has this tool? (optional metadata)
    const getToolBorrower = (toolId) => {
        const target = normalizeId(toolId);
        if (!target) return undefined;
        return realOutstanding.find(tx => normalizeId(tx.tool_id) === target);
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

        setTransactions(prev => [...prev, optimisticTx]);

        try {
            const result = await fetchFromSheet(transactionData.action, transactionData);
            await loadData(true);
            return result.data;
        } catch (e) {
            setTransactions(prev => prev.filter(tx => tx.id !== tempId));
            console.error('Network Error', e);
            throw e;
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

        setTransactions(prev => [...prev, ...optimisticTxs]);

        try {
            const result = await fetchFromSheet('BATCH_TRANSACTIONS', {
                transactions: transactionsArray
            });
            await loadData(true);
            return result.data;
        } catch (e) {
            setTransactions(prev => prev.filter(tx => !tempIds.has(tx.id)));
            console.error('Batch Network Error', e);
            throw e;
        }
    };

    const markUnserviceable = async (toolId, reason, markedBy) => {
        let previousTool = null;
        const targetId = normalizeId(toolId);

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
            await loadData(true);
            return result.data;
        } catch (e) {
            if (previousTool) {
                setTools(prev => prev.map(t => (t.id === previousTool.id ? previousTool : t)));
            }
            console.error('Error marking unserviceable:', e);
            throw e;
        }
    };

    const markServiceable = async (toolId) => {
        let previousTool = null;
        const targetId = normalizeId(toolId);

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
            await loadData(true);
            return result.data;
        } catch (e) {
            if (previousTool) {
                setTools(prev => prev.map(t => (t.id === previousTool.id ? previousTool : t)));
            }
            console.error('Error marking serviceable:', e);
            throw e;
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
