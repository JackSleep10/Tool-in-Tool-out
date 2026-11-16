import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchFromSheet } from '../services/api';

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
            const result = await fetchFromSheet('GET_ALL_DATA');
            if (result && result.status === 'success') {
                const data = result.data;
                const newEmps = data.employees || [];
                const newTools = data.tools || [];
                const newTxs = data.transactions || [];

                setEmployees(newEmps);
                setTools(newTools);
                setTransactions(newTxs);
                setHasFullHistory(!!data.has_full_history);
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
        if (hasFullHistory) return;
        setIsRefreshing(true);
        try {
            const result = await fetchFromSheet('GET_FULL_HISTORY');
            if (result && result.status === 'success') {
                const fullTxs = result.data.transactions || [];
                setTransactions(fullTxs);
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

    /**
     * Calculate Outstanding Logic (Replay History)
     */
    const calculateOutstanding = () => {
        if (!transactions || transactions.length === 0) return [];

        const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        let currentOutstanding = [];

        sorted.forEach(tx => {
            if (tx.action === 'BORROW') {
                currentOutstanding.push(tx);
            } else if (tx.action === 'RETURN') {
                // Find a match by Tool ID and Employee ID
                const index = currentOutstanding.findIndex(item =>
                    item.tool_id === tx.tool_id &&
                    item.employee_id === tx.employee_id
                );

                if (index !== -1) {
                    currentOutstanding.splice(index, 1);
                }
            }
        });

        return currentOutstanding.reverse();
    };

    const realOutstanding = useMemo(() => calculateOutstanding(), [transactions]);

    // Helper: Is this specific physical tool currently borrowed by ANYONE?
    const isToolCurrentlyOut = (toolId) => {
        return realOutstanding.some(tx => tx.tool_id === toolId);
    };

    // Helper: Who has this tool? (optional metadata)
    const getToolBorrower = (toolId) => {
        return realOutstanding.find(tx => tx.tool_id === toolId);
    };

    // Actions
    const addTransaction = async (transactionData) => {
        // Optimistic Update
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
            if (result && result.status === 'success') {
                loadData(true);
            }
        } catch (e) {
            console.error('Network Error', e);
        }
    };

    const addBatchTransactions = async (transactionsArray) => {
        if (!transactionsArray || transactionsArray.length === 0) return;

        // Optimistic Update - Add all as pending
        const now = new Date().toISOString();
        const optimisticTxs = transactionsArray.map((tx, index) => ({
            ...tx,
            id: `temp_${Date.now()}_${index}`,
            date: now,
            status: 'PENDING_SERVER'
        }));

        setTransactions(prev => [...prev, ...optimisticTxs]);

        try {
            const result = await fetchFromSheet('BATCH_TRANSACTIONS', {
                transactions: transactionsArray
            });
            if (result && result.status === 'success') {
                loadData(true);
            }
        } catch (e) {
            console.error('Batch Network Error', e);
        }
    };

    const markUnserviceable = async (toolId, reason, markedBy) => {
        setTools(prev => prev.map(t => {
            if (t.id?.toString().toLowerCase() === toolId?.toString().toLowerCase()) {
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
            if (result && result.status === 'success') {
                loadData(true);
            }
        } catch (e) {
            console.error('Error marking unserviceable:', e);
        }
    };

    const markServiceable = async (toolId) => {
        setTools(prev => prev.map(t => {
            if (t.id?.toString().toLowerCase() === toolId?.toString().toLowerCase()) {
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
            if (result && result.status === 'success') {
                loadData(true);
            }
        } catch (e) {
            console.error('Error marking serviceable:', e);
        }
    };

    const getStats = () => {
        if (loading && !tools.length) return { borrowedToday: 0, returnedToday: 0, outstanding: 0, unserviceable: 0 };
        const today = new Date().toISOString().split('T')[0];
        const todayTx = transactions.filter(t => {
            try { return new Date(t.date).toISOString().startsWith(today); }
            catch (e) { return false; }
        });

        const unserviceableCount = tools.filter(t =>
            (t.serviceability_status || '').toUpperCase() === 'UNSERVICEABLE'
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
