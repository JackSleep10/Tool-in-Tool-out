import { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Calendar, Download, ChevronLeft, ChevronRight, ShoppingBasket, Wrench } from 'lucide-react';
import {
    getTodayDateKey,
    toBangkokDateKey,
    shiftDateKey,
    isDateKeyOlderThanDays,
    formatThaiDate,
    formatThaiTime
} from '../utils/date';
import { buildReportCsv } from '../utils/csv';
import './Summary.css';

const Summary = () => {
    const { transactions, outstandingTransactions, fetchFullHistory, hasFullHistory, isRefreshing } = useStore();
    const [selectedDate, setSelectedDate] = useState(() => getTodayDateKey());
    const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'outstanding'
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = Outstanding First, 'asc' = Returned First

    const isOlderThan30Days = useMemo(
        () => isDateKeyOlderThanDays(selectedDate, 30),
        [selectedDate]
    );

    const outstandingIdSet = useMemo(
        () => new Set(outstandingTransactions.map(out => out.id)),
        [outstandingTransactions]
    );

    const toggleSort = () => {
        setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    // --- Statistics Logic ---
    const stats = useMemo(() => {
        const dailyTx = transactions.filter(tx => toBangkokDateKey(tx?.date) === selectedDate);
        const borrowTxRaw = dailyTx.filter(tx => tx.action === 'BORROW');
        const returnTx = dailyTx.filter(tx => tx.action === 'RETURN');

        // Sort Daily Borrow Log
        const borrowTx = [...borrowTxRaw].sort((a, b) => {
            const isOutA = outstandingIdSet.has(a.id);
            const isOutB = outstandingIdSet.has(b.id);

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
    }, [transactions, selectedDate, outstandingIdSet, sortOrder]);

    // Outstanding List Logic (Sorted by Date Ascending)
    const sortedOutstanding = useMemo(() => {
        return [...outstandingTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [outstandingTransactions]);

    const changeDate = (days) => {
        setSelectedDate(prev => shiftDateKey(prev, days));
    };

    const downloadCSV = () => {
        const dataToExport = viewMode === 'daily' ? stats.borrowTx : sortedOutstanding;
        if (dataToExport.length === 0) return;

        const csvContent = buildReportCsv({ rows: dataToExport, outstandingIdSet });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report_${viewMode === 'daily' ? selectedDate : 'outstanding'}_${getTodayDateKey()}.csv`;
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
                            type="button"
                            className={`toggle-btn ${viewMode === 'daily' ? 'active' : ''}`}
                            onClick={() => setViewMode('daily')}
                        >
                            <Calendar size={18} /> รายงานรายวัน
                        </button>
                        <button
                            type="button"
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
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => changeDate(-1)}
                                aria-label="วันก่อนหน้า"
                            >
                                <ChevronLeft />
                            </button>
                            <h2 className="date-display">{formatThaiDate(selectedDate)}</h2>
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => changeDate(1)}
                                aria-label="วันถัดไป"
                            >
                                <ChevronRight />
                            </button>
                        </div>
                        <div className="date-tools-sub">
                            <div className="date-picker-wrapper">
                                <Calendar size={18} className="picker-icon" />
                                <input
                                    type="date"
                                    aria-label="เลือกวันที่ดูรายงาน"
                                    value={selectedDate}
                                    onChange={(e) => {
                                        if (e.target.value) setSelectedDate(e.target.value);
                                    }}
                                />
                            </div>
                            <button type="button" className="btn-export" onClick={downloadCSV} title="Export CSV">
                                <Download size={18} /> Export
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isOlderThan30Days && !hasFullHistory && (
                <div className="history-banner">
                    <span>📅 วันที่เลือกอยู่นอกช่วง 30 วันล่าสุด คุณต้องการโหลดข้อมูลประวัติย้อนหลังทั้งหมดหรือไม่?</span>
                    <button
                        type="button"
                        className="history-banner-btn"
                        onClick={fetchFullHistory}
                        disabled={isRefreshing}
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
                                                <col className="col-w-14" />
                                                <col className="col-w-36" />
                                                <col className="col-w-20" />
                                                <col className="col-w-18" />
                                                <col className="col-w-12" />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th>เวลา</th>
                                                    <th>อุปกรณ์</th>
                                                    <th>พนักงาน</th>
                                                    <th>ผู้จ่ายของ</th>
                                                    <th
                                                        onClick={toggleSort}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                toggleSort();
                                                            }
                                                        }}
                                                        tabIndex={0}
                                                        role="button"
                                                        className="sort-th"
                                                        title="กดเพื่อเรียงลำดับ"
                                                    >
                                                        <div className="sort-header-inner">
                                                            สถานะ
                                                            <div className="sort-arrows">
                                                                <span className={`sort-arrow ${sortOrder === 'asc' ? 'active' : ''}`}>▲</span>
                                                                <span className={`sort-arrow ${sortOrder === 'desc' ? 'active' : ''}`}>▼</span>
                                                            </div>
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.borrowTx.length > 0 ? stats.borrowTx.map(tx => {
                                                    const isOutstanding = outstandingIdSet.has(tx.id);
                                                    const remarkText = String(tx.remark ?? '').trim();
                                                    return (
                                                        <tr key={tx.id}>
                                                            <td className="time-col">{formatThaiTime(tx.date)}</td>
                                                            <td>
                                                                <div className="tool-cell">
                                                                    <strong>{tx.tool_name}</strong>
                                                                    <span className="remark-text">{remarkText && remarkText !== '-' ? `(${remarkText})` : ''}</span>
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
                                            const isOutstanding = outstandingIdSet.has(tx.id);
                                            const timeStr = formatThaiTime(tx.date);
                                            const remarkText = String(tx.remark ?? '').trim();
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
                                                        {remarkText && remarkText !== '-' && (
                                                            <div className="m-row m-remark-row">
                                                                <span className="m-label">หมายเหตุ:</span>
                                                                <span className="m-val">{remarkText}</span>
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
                                                <col className="col-w-14" />
                                                <col className="col-w-36" />
                                                <col className="col-w-20" />
                                                <col className="col-w-18" />
                                                <col className="col-w-12" />
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
                                                        <td className="time-col">{formatThaiTime(tx.date)}</td>
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
                                            const timeStr = formatThaiTime(tx.date);
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
                            <button type="button" className="btn-export btn-export-auto" onClick={downloadCSV} title="Export CSV">
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
                                                    <strong>{formatThaiDate(tx.date)}</strong>
                                                </td>
                                                <td className="time-col">{formatThaiTime(tx.date)}</td>
                                                <td>
                                                    <div className="tool-cell">
                                                        <strong>{tx.tool_name}</strong>
                                                        <span className="remark-text">{tx.id}</span>
                                                    </div>
                                                </td>
                                                <td>{tx.employee_name} <br /><small className="sub-emp-id">{tx.employee_id}</small></td>
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
                                    const timeStr = formatThaiTime(tx.date);
                                    const remarkText = String(tx.remark ?? '').trim();
                                    return (
                                        <div key={tx.id} className="mobile-summary-card is-outstanding">
                                            <div className="m-card-top">
                                                <span className="m-tool-title">{tx.tool_name}</span>
                                                <span className="badge-status outstanding">ยังไม่คืน</span>
                                            </div>
                                            <div className="m-card-details">
                                                <div className="m-row">
                                                    <span className="m-label">วันที่ยืม:</span>
                                                    <span className="m-val date-highlight">{formatThaiDate(tx.date)} ({timeStr} น.)</span>
                                                </div>
                                                <div className="m-row">
                                                    <span className="m-label">ผู้เบิก:</span>
                                                    <span className="m-val emp-highlight">{tx.employee_name} <span className="id-sub">({tx.employee_id})</span></span>
                                                </div>
                                                <div className="m-row">
                                                    <span className="m-label">ผู้จ่ายของ:</span>
                                                    <span className="m-val">{tx.staff_issuer || '-'}</span>
                                                </div>
                                                {remarkText && remarkText !== '-' && (
                                                    <div className="m-row m-remark-row">
                                                        <span className="m-label">หมายเหตุ:</span>
                                                        <span className="m-val">{remarkText}</span>
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
