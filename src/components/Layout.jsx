import React, { useState } from 'react';
import { LayoutDashboard, ShoppingBasket, History, Menu, X, UserCircle, ClipboardList, QrCode, ShieldAlert, RefreshCw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import logo from '../assets/logo.png';

const Layout = ({ children, activeTab, onTabChange }) => {
  const { isRefreshing } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'borrow', label: 'Borrow (เบิกของ)', icon: ShoppingBasket },
    { id: 'return', label: 'Return (คืนของ)', icon: History },
    { id: 'summary', label: 'Summary (สรุปรายวัน)', icon: ClipboardList },
    { id: 'qr-mgmt', label: 'QR Codes (จัดการ QR)', icon: QrCode },
    { id: 'unserviceable', label: 'Unserviceable (อุปกรณ์ชำรุด)', icon: ShieldAlert },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <img src={logo} alt="Thai Lion Air" className="sidebar-logo" />
            <div className="logo-text">
              <h2>Tools in - Tools out</h2>
              <span className="badge">Admin</span>
            </div>
          </div>
          <button className="mobile-toggle" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <UserCircle size={32} />
            <div>
              <p className="name">Staff Store</p>
              <p className="role">Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        <header className="top-bar">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu size={24} />
          </button>
          <h1 className="page-title">
            {NAV_ITEMS.find(i => i.id === activeTab)?.label}
          </h1>
          {isRefreshing && (
            <div className="sync-status-badge">
              <RefreshCw size={13} className="spin-icon" />
              <span>ซิงค์ข้อมูล...</span>
            </div>
          )}
        </header>

        <div className="content-area" key={activeTab}>
          {children}
        </div>
      </main>

      <style>{`
        .layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background-color: var(--bg-color);
        }

        /* Sidebar Styles */
        .sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          transition: margin-left 0.3s ease, transform 0.3s ease;
          z-index: 50;
          flex-shrink: 0;
        }

        .sidebar.closed {
          margin-left: -260px;
        }

        .sidebar-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
        }

        .logo-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: flex-start;
        }

        .sidebar-logo {
          height: 32px;
          width: auto;
          object-fit: contain;
        }

        .logo-text h2 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--primary-color);
          font-weight: 700;
          line-height: 1.2;
        }

        .badge {
          display: inline-block;
          background: #fff1f2;
          color: var(--primary-color);
          padding: 1px 8px;
          border-radius: 12px;
          font-size: 0.7rem;
          font-weight: 600;
          margin-top: 4px;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 500;
          transition: all 0.2s;
          text-align: left;
        }

        .nav-item:hover {
          background: #f1f5f9;
          color: var(--text-main);
        }

        .nav-item.active {
          background: var(--primary-color);
          color: white;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid var(--border-color);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-main);
        }

        .user-info .name {
          margin: 0;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .user-info .role {
          margin: 0;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        /* Main Content */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .top-bar {
          height: 64px;
          background: white;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
        }

        .sync-status-badge {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #f1f5f9;
          color: #64748b;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .spin-icon {
          animation: layout-spin 1s linear infinite;
        }

        @keyframes layout-spin {
          100% { transform: rotate(360deg); }
        }

        .menu-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .menu-btn:hover {
          background: #f1f5f9;
        }

        .page-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .content-area {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          animation: fadeIn 0.3s ease-out;
        }

        .mobile-toggle {
            display: none;
            background: none;
            border: none;
            cursor: pointer;
        }

        .sidebar-backdrop {
          display: none;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .sidebar-backdrop {
            display: block;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.45);
            backdrop-filter: blur(2px);
            z-index: 45;
          }

          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            height: 100%;
            transform: translateX(-100%);
            margin-left: 0;
            box-shadow: 4px 0 24px rgba(0,0,0,0.15);
            z-index: 50;
          }

          .sidebar.open {
            transform: translateX(0);
            margin-left: 0;
          }

          .sidebar.closed {
            transform: translateX(-100%);
            margin-left: 0;
          }

          .mobile-toggle {
            display: block;
          }
          
          .top-bar {
            padding: 0 16px;
          }
          
          .content-area {
            padding: 16px;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media print {
          /* Hide non-essential layout elements */
          .sidebar, .top-bar, .mobile-toggle, .menu-btn, .no-print {
            display: none !important;
          }
          
          /* Force all containers to be visible and non-scrollable */
          html, body, #root, .layout, .main-content, .content-area {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            opacity: 1 !important;
            visibility: visible !important;
            animation: none !important;
            transition: none !important;
            box-shadow: none !important;
            background: white !important;
            transform: none !important;
            flex: none !important;
          }

          .main-content {
            width: 100% !important;
          }

          .content-area {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;
