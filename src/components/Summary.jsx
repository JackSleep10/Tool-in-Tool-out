import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { FileText, Calendar, Download, ChevronLeft, ChevronRight, ShoppingBasket, Wrench } from 'lucide-react';
import './Summary.css';

const Summary = () => {
    const { transactions, outstandingTransactions, fetchFullHistory, hasFullHistory, isRefreshing } = useStore();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'outstanding'
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = Outstanding First, 'asc' = Returned First

    const isOlderThan30Days = useMemo(() => {
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        return new Date(selectedDate).getTime() < cutoff;
    }, [selectedDate]);

    // Format helpers
    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const toggleSort = () => {
        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    // --- Statistics Logic ---
    const stats = useMemo(() => {
        const dailyTx = transactions.filter(tx => tx.date.startsWith(selectedDate));
        const borrowTxRaw = dailyTx.filter(tx => tx.action === 'BORROW');
        const returnTx = dailyTx.filter(tx => tx.action === 'RETURN');

        // Sort Daily Borrow Log
        const borrowTx = [...borrowTxRaw].sort((a, b) => {
            const isOutA = outstandingTransactions.some(out => out.id === a.id);
            const isOutB = outstandingTransactions.some(out => out.id === b.id);

            if (sortOrder === 'desc') {
                if (isOutA && !isOutB) return -1;
                if (!isOutA && isOutB) return 1;
            } else {
                if (isOutA && !isOutB) return 1;
                if (!isOutA && isOutB) return -1;
            }
            return new Date(a.date) - new Date(b.date);
        });

        return {
            borrowCount: borrowTx.length,
            returnCount: returnTx.length,
            borrowTx,
            returnTx
        };
    }, [transactions, selectedDate, outstandingTransactions, sortOrder]);

    // Outstanding List Logic (Sorted by Date Ascending)
    const sortedOutstanding = useMemo(() => {
        return [...outstandingTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [outstandingTransactions]);

    const changeDate = (days) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    const downloadCSV = () => {
        const dataToExport = viewMode === 'daily' ? stats.borrowTx : sortedOutstanding;
        if (dataToExport.length === 0) return;

        const headers = ['Date', 'Time', 'Tool', 'Employee', 'Staff', 'Status'];
        const rows = dataToExport.map(tx => {
            const d = new Date(tx.date);
            const isOut = outstandingTransactions.some(out => out.id === tx.id);
            return [
                d.toLocaleDateString('th-TH'),
                d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
                `"${tx.tool_name}"`,
                `"${tx.employee_name}"`,
                `"${tx.staff_issuer || tx.staff_receiver || '-'}"`,
                isOut ? 'ยังไม่คืน' : 'คืนแล้ว'
            ].join(',');
        });

        const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_${viewMode === 'daily' ? selectedDate : 'outstanding'}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="summary-container">
            {/* Header / View Selector */}
            <div className="summary-header">
                <div className="header-left">
                    <div className="view-toggles">
                        <button
                            className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
                            onClick={() => setViewMode('daily')}
                        >
                            <Calendar size={18} /> รายงานรายวัน
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'outstanding' ? 'active' : ''}`}
                            onClick={() => setViewMode('outstanding')}
                        >
                            <Wrench size={18} /> รายการค้างส่ง ({sortedOutstanding.length})
                        </button>
                    </div>
                </div>

                {viewMode === 'daily' && (
                    <div className="report-actions">
                        <div className="date-controls">
                            <button className="icon-btn" onClick={() => changeDate(-1)}><ChevronLeft /></button>
                            <h2 className="date-display">{formatDate(selectedDate)}</h2>
                            <button className="icon-btn" onClick={() => changeDate(1)}><ChevronRight /></button>
                        </div>
                        <div className="date-tools-sub">
                            <div className="date-picker-wrapper">
                                <Calendar size={18} className="picker-icon" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                            <button className="btn-export" onClick={downloadCSV} title="Export CSV">
                                <Download size={18} /> Export
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isOlderThan30Days && !hasFullHistory && (
                <div style={{
                    margin: '0 0 16px 0',
                    padding: '12px 16px',
                    background: '#fff8e1',
                    border: '1px solid #ffe082',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    color: '#8d6e63',
                    fontSize: '14px'
                }}>
                    <span>📅 วันที่เลือกอยู่นอกช่วง 30 วันล่าสุด คุณต้องการโหลดข้อมูลประวัติย้อนหลังทั้งหมดหรือไม่?</span>
                    <button
                        onClick={fetchFullHistory}
                        disabled={isRefreshing}
                        style={{
                            background: '#d32f2f',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            cursor: isRefreshing ? 'not-allowed' : 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        {isRefreshing ? 'กำลังโหลดประวัติ...' : 'โหลดประวัติทั้งหมด'}
                    </button>
                </div>
            )}

            {viewMode === 'daily' ? (
                <>
                    {/* Quick Stats Row */}
                    <div className="summary-grid">
                        <div className="stat-box primary">
                            <ShoppingBasket size={24} />
                            <div className="val">{stats.borrowCount}</div>
                            <div className="lab">รายการเบิกยืม</div>
                        </div>
                        <div className="stat-box secondary">
                            <Download size={24} />
                            <div className="val">{stats.returnCount}</div>
                            <div className="lab">รายการรับคืน</div>
                        </div>
                    </div>

                    <div className="reports-layout split-row">
                        {/* Borrow Log */}
                        <div className="log-panel">
                            <div className="card-custom">
                                <div className="card-title text-primary"><ShoppingBasket size={18} /> รายละเอียดการเบิก (Borrow Log)</div>
                                <div className="table-wrapper">
                                    {/* Desktop Table View */}
                                    <div className="desktop-table-view">
                                        <table className="summary-table fixed-table">
                                            <colgroup>
                                                <col style={{width: '14%'}} />
                                                <col style={{width: '36%'}} />
                                                <col style={{width: '20%'}} />
                                                <col style={{width: '18%'}} />
                                                <col style={{width: '12%'}} />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th>เวลา</th>
                                                    <th>อุปกรณ์</th>
                                                    <th>พนักงาน</th>
                                                    <th>ผู้จ่ายของ</th>
                                                    <th
                                                        onClick={toggleSort}
                                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                                        title="กดเพื่อเรียงลำดับ"
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            สถานะ
                                                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '0.5' }}>
                                                                <span style={{ opacity: sortOrder === 'asc' ? 1 : 0.3, fontSize: '10px' }}>▲</span>
                                                                <span style={{ opacity: sortOrder === 'desc' ? 1 : 0.3, fontSize: '10px' }}>▼</span>
                                                            </div>
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.borrowTx.length > 0 ? stats.borrowTx.map(tx => {
                                                    const isOutstanding = outstandingTransactions.some(out => out.id === tx.id);
                                                    return (
                                                        <tr key={tx.id}>
                                                            <td className="time-col">{new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                                                            <td>
                                                                <div className="tool-cell">
                                                                    <strong>{tx.tool_name}</strong>
                                                                    <span className="remark-text">{tx.remark && tx.remark !== '-' ? `(${tx.remark})` : ''}</span>
                                                                </div>
                                                            </td>
                                                            <td>{tx.employee_name}</td>
                                                            <td className="staff-col">{tx.staff_issuer}</td>
                                                            <td>
                                                                {isOutstanding ? (
                                                                    <span className="badge-status outstanding">ยังไม่คืน</span>
                                                                ) : (
                                                                    <span className="badge-status returned">คืนแล้ว</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                }) : (
                                                    <tr><td colSpan="5" className="empty-row">ไม่มีรายการเบิก</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Cards View */}
                                    <div className="mobile-cards-view">
                                        {stats.borrowTx.length > 0 ? stats.borrowTx.map(tx => {
                                            const isOutstanding = outstandingTransactions.some(out => out.id === tx.id);
                                            const timeStr = new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                            return (
                                                <div key={tx.id} className="mobile-summary-card">
                                                    <div className="m-card-top">
                                                        <span className="m-tool-title">{tx.tool_name}</span>
                                                        {isOutstanding ? (
                                                            <span className="badge-status outstanding">ยังไม่คืน</span>
                                                        ) : (
                                                            <span className="badge-status returned">คืนแล้ว</span>
                                                        )}
                                                    </div>
                                                    <div className="m-card-details">
                                                        <div className="m-row">
                                                            <span className="m-label">เวลาเบิก:</span>
                                                            <span className="m-val time-highlight">{timeStr} น.</span>
                                                        </div>
                                                        <div className="m-row">
                                                            <span className="m-label">ผู้เบิก:</span>
                                                            <span className="m-val emp-highlight">{tx.employee_name} <span className="id-sub">({tx.employee_id})</span></span>
                                                        </div>
                                                        <div className="m-row">
                                                            <span className="m-label">ผู้จ่ายของ:</span>
                                                            <span className="m-val">{tx.staff_issuer || '-'}</span>
                                                        </div>
                                                        {tx.remark && tx.remark !== '-' && (
                                                            <div className="m-row m-remark-row">
                                                                <span className="m-label">หมายเหตุ:</span>
                                                                <span className="m-val">{tx.remark}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="empty-row">ไม่มีรายการเบิก</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Return Log */}
                        <div className="log-panel">
                            <div className="card-custom">
                                <div className="card-title text-success"><Download size={18} /> รายละเอียดการคืน (Return Log)</div>
                                <div className="table-wrapper">
                                    {/* Desktop Table View */}
                                    <div className="desktop-table-view">
                                        <table className="summary-table fixed-table">
                                            <colgroup>
                                                <col style={{width: '14%'}} />
                                                <col style={{width: '36%'}} />
                                                <col style={{width: '20%'}} />
                                                <col style={{width: '18%'}} />
                                                <col style={{width: '12%'}} />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th>เวลา</th>
                                                    <th>อุปกรณ์</th>
                                                    <th>พนักงาน</th>
                                                    <th>ผู้รับคืน</th>
                                                    <th>สถานะ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.returnTx.length > 0 ? stats.returnTx.map(tx => (
                                                    <tr key={tx.id}>
                                                        <td className="time-col">{new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td>{tx.tool_name}</td>
                                                        <td>{tx.employee_name}</td>
                                                        <td className="staff-col">{tx.staff_receiver}</td>
                                                        <td><span className="badge-status returned">คืนแล้ว</span></td>
                                                    </tr>
                                                )) : (
                                                    <tr><td colSpan="5" className="empty-row">ไม่มีรายการคืน</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Cards View */}
                                    <div className="mobile-cards-view">
                                        {stats.returnTx.length > 0 ? stats.returnTx.map(tx => {
                                            const timeStr = new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                            return (
                                                <div key={tx.id} className="mobile-summary-card">
                                                    <div className="m-card-top">
                                                        <span className="m-tool-title">{tx.tool_name}</span>
                                                        <span className="badge-status returned">คืนแล้ว</span>
                                                    </div>
                                                    <div className="m-card-details">
                                                        <div className="m-row">
                                                            <span className="m-label">เวลารับคืน:</span>
                                                            <span className="m-val time-highlight">{timeStr} น.</span>
                                                        </div>
                                                        <div className="m-row">
                                                            <span className="m-label">ผู้ส่งคืน:</span>
                                                            <span className="m-val emp-highlight">{tx.employee_name} <span className="id-sub">({tx.employee_id})</span></span>
                                                        </div>
                                                        <div className="m-row">
                                                            <span className="m-label">ผู้รับคืน:</span>
                                                            <span className="m-val">{tx.staff_receiver || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="empty-row">ไม่มีรายการคืน</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* Outstanding Items View */
                <div className="log-panel full-width">
                    <div className="card-custom">
                        <div className="card-title text-danger">
                            <Wrench size={18} /> รายการค้างส่งทั้งหมด (All Outstanding)
                            <span className="sub-label">เรียงจากเก่าไปใหม่ (Oldest First)</span>
                            <button className="btn-export" onClick={downloadCSV} title="Export CSV" style={{marginLeft: 'auto'}}>
                                <Download size={18} /> Export
                            </button>
                        </div>
                        <div className="table-wrapper">
                            {/* Desktop Table View */}
                            <div className="desktop-table-view">
                                <table className="summary-table">
                                    <thead>
                                        <tr>
                                            <th>วันที่ยืม (Borrowed Date)</th>
                                            <th>เวลา</th>
                                            <th>อุปกรณ์</th>
                                            <th>พนักงาน</th>
                                            <th>ผู้จ่ายของ</th>
                                            <th>สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedOutstanding.length > 0 ? sortedOutstanding.map(tx => (
                                            <tr key={tx.id}>
                                                <td className="date-col">
                                                    <strong>{formatDate(tx.date)}</strong>
                                                </td>
                                                <td className="time-col">{new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td>
                                                    <div className="tool-cell">
                                                        <strong>{tx.tool_name}</strong>
                                                        <span className="remark-text">{tx.id}</span>
                                                    </div>
                                                </td>
                                                <td>{tx.employee_name} <br /><small style={{ color: '#666' }}>{tx.employee_id}</small></td>
                                                <td className="staff-col">{tx.staff_issuer}</td>
                                                <td>
                                                    <span className="badge-status outstanding">ยังไม่คืน</span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="6" className="empty-row">ยอดเยี่ยม! ไม่มีการค้างส่งอุปกรณ์</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards View */}
                            <div className="mobile-cards-view">
                                {sortedOutstanding.length > 0 ? sortedOutstanding.map(tx => {
                                    const timeStr = new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                                    return (
                                        <div key={tx.id} className="mobile-summary-card is-outstanding">
                                            <div className="m-card-top">
                                                <span className="m-tool-title">{tx.tool_name}</span>
                                                <span className="badge-status outstanding">ยังไม่คืน</span>
                                            </div>
                                            <div className="m-card-details">
                                                <div className="m-row">
                                                    <span className="m-label">วันที่ยืม:</span>
                                                    <span className="m-val date-highlight">{formatDate(tx.date)} ({timeStr} น.)</span>
                                                </div>
                                                <div className="m-row">
                                                    <span className="m-label">ผู้เบิก:</span>
                                                    <span className="m-val emp-highlight">{tx.employee_name} <span className="id-sub">({tx.employee_id})</span></span>
                                                </div>
                                                <div className="m-row">
                                                    <span className="m-label">ผู้จ่ายของ:</span>
                                                    <span className="m-val">{tx.staff_issuer || '-'}</span>
                                                </div>
                                                {tx.remark && tx.remark !== '-' && (
                                                    <div className="m-row m-remark-row">
                                                        <span className="m-label">หมายเหตุ:</span>
                                                        <span className="m-val">{tx.remark}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="empty-row">ยอดเยี่ยม! ไม่มีการค้างส่งอุปกรณ์</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Summary;
