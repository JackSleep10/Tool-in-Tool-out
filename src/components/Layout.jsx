import { useState } from 'react';
import { LayoutDashboard, ShoppingBasket, History, Menu, X, UserCircle, ClipboardList, QrCode, ShieldAlert, RefreshCw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import logo from '../assets/logo.png';
import './Layout.css';

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
          <button
            type="button"
            className="mobile-toggle"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="ปิดเมนูด้านข้าง"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
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
          <button
            type="button"
            className="menu-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? 'ซ่อนเมนูนำทาง' : 'เปิดเมนูนำทาง'}
          >
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
    </div>
  );
};

export default Layout;
