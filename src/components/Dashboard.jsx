import React from 'react';
import { useStore } from '../context/StoreContext';
import { Clock, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { formatThaiDateTime } from '../utils/date';
import { normalizeId } from '../utils/transactions';
import './Dashboard.css';
const Dashboard = () => {
  const { getStats, outstandingTransactions, toolsByIdMap } = useStore();
  const stats = getStats();

  // Helper to format date for display
  const formatDate = (isoString) => formatThaiDateTime(isoString, { shortYear: true });

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="icon-wrapper"><Clock size={24} /></div>
          <div className="info">
            <h3>Borrowed Today</h3>
            <p className="value">{stats.borrowedToday}</p>
            <p className="sub">รายการเบิกวันนี้</p>
          </div>
        </div>

        <div className="stat-card success">
          <div className="icon-wrapper"><CheckCircle size={24} /></div>
          <div className="info">
            <h3>Returned Today</h3>
            <p className="value">{stats.returnedToday}</p>
            <p className="sub">รับคืนแล้ววันนี้</p>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="icon-wrapper"><AlertCircle size={24} /></div>
          <div className="info">
            <h3>Outstanding</h3>
            <p className="value">{stats.outstanding}</p>
            <p className="sub">ค้างส่งทั้งหมด</p>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="icon-wrapper"><ShieldAlert size={24} /></div>
          <div className="info">
            <h3>Unserviceable</h3>
            <p className="value">{stats.unserviceable}</p>
            <p className="sub">อุปกรณ์ชำรุด</p>
          </div>
        </div>
      </div>

      <div className="outstanding-section">
        <div className="section-header">
          <h2>📦 รายการค้างส่ง (Outstanding Items)</h2>
          <span className="timestamp">Updated: {new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
        </div>

        <div className="table-container">
          {outstandingTransactions.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="desktop-table-view">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Tool</th>
                      <th>Employee</th>
                      <th>Issuer</th>
                      <th>Remark</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingTransactions.map(tx => {
                      const txToolId = normalizeId(tx.tool_id);
                      const loc = (txToolId && toolsByIdMap.get(txToolId)?.location) || '-';
                      const remarkText = String(tx.remark ?? '').trim();
                      return (
                        <tr key={tx.id}>
                          <td>{formatDate(tx.date)}</td>
                          <td>
                            <div className="tool-info">
                              <span className="tool-name">{tx.tool_name}</span>
                              <span className="tool-id">Location: {loc}</span>
                            </div>
                          </td>
                          <td>
                            <div className="emp-info">
                              <span className="emp-name">{tx.employee_name}</span>
                              <span className="emp-id">{tx.employee_id}</span>
                            </div>
                          </td>
                          <td>{tx.staff_issuer}</td>
                          <td>
                            <span className="remark-text">{remarkText || '-'}</span>
                          </td>
                          <td>
                            {(() => {
                              const hoursOut = (Date.now() - new Date(tx.date).getTime()) / (1000 * 60 * 60);
                              return hoursOut > 24 ? (
                                <span className="status-badge overdue" title={`ค้างคืน ${Math.floor(hoursOut)} ชม.`}>⚠️ เกิน {Math.floor(hoursOut)} ชม.</span>
                              ) : (
                                <span className="status-badge pending">ค้างคืน</span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="mobile-cards-view">
                {outstandingTransactions.map(tx => {
                  const txToolId = normalizeId(tx.tool_id);
                  const loc = (txToolId && toolsByIdMap.get(txToolId)?.location) || '-';
                  const hoursOut = (Date.now() - new Date(tx.date).getTime()) / (1000 * 60 * 60);
                  const isOverdue = hoursOut > 24;
                  const remarkText = String(tx.remark ?? '').trim();

                  return (
                    <div key={tx.id} className={`mobile-out-card ${isOverdue ? 'is-overdue' : ''}`}>
                      <div className="mobile-out-header">
                        <div className="mobile-out-tool">
                          <span className="mobile-tool-name">{tx.tool_name}</span>
                          <span className="mobile-tool-loc">📍 {loc}</span>
                        </div>
                        <div className="mobile-out-badge">
                          {isOverdue ? (
                            <span className="status-badge overdue">⚠️ เกิน {Math.floor(hoursOut)} ชม.</span>
                          ) : (
                            <span className="status-badge pending">ค้างคืน</span>
                          )}
                        </div>
                      </div>

                      <div className="mobile-out-body">
                        <div className="mobile-info-row">
                          <span className="info-label">ผู้เบิก:</span>
                          <span className="info-val emp-highlight">{tx.employee_name} <span className="id-sub">({tx.employee_id})</span></span>
                        </div>
                        <div className="mobile-info-row">
                          <span className="info-label">ผู้จ่ายของ:</span>
                          <span className="info-val">{tx.staff_issuer || '-'}</span>
                        </div>
                        <div className="mobile-info-row">
                          <span className="info-label">เวลาที่เบิก:</span>
                          <span className="info-val time-highlight">{formatDate(tx.date)}</span>
                        </div>
                        {remarkText && remarkText !== '-' && (
                          <div className="mobile-info-row remark-row">
                            <span className="info-label">หมายเหตุ:</span>
                            <span className="info-val remark-val">{remarkText}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <CheckCircle size={48} />
              <p>ไม่มีรายการค้างส่ง</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
