import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  X, 
  Layers, 
  LayoutDashboard, 
  Zap, 
  Database, 
  Download, 
  Settings,
  HelpCircle
} from 'lucide-react';
import './Layout.css';

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface LayoutMenuItem {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
}

interface LayoutProps {
  /** The currently selected navigation item ID */
  activeItemId?: string;
  /** Callback fired when a navigation item is clicked */
  onItemSelect?: (id: string) => void;
  /** Custom navigation menu items list */
  menuItems?: LayoutMenuItem[];
  /** React elements to render inside the top header right side */
  headerRight?: React.ReactNode;
  /** Custom title or elements for the top header left side */
  headerTitle?: React.ReactNode;
  /** Layout body content */
  children: React.ReactNode;
  /** User profile details for the sidebar footer */
  user?: {
    name: string;
    role: string;
    avatarInitials?: string;
  };
}

export const Layout: React.FC<LayoutProps> = ({
  activeItemId,
  onItemSelect,
  menuItems,
  headerRight,
  headerTitle = "Hệ thống Tối ưu hóa",
  children,
  user = { name: "Quang Khánh", role: "QA Engineer Manager", avatarInitials: "QK" }
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check screen width for responsiveness to disable/enable hamburger toggles
  useEffect(() => {
    const checkViewport = () => {
      const mobileView = window.innerWidth <= 768;
      setIsMobile(mobileView);
      if (!mobileView) {
        setSidebarOpen(false); // Close sidebar on transition to desktop view
      }
    };
    
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // Default menu items if none are provided
  const defaultMenuItems: LayoutMenuItem[] = [
    { id: 'dashboard', label: 'Bảng Điều Khiển', icon: <LayoutDashboard size={18} /> },
    { id: 'prepare', label: '1 · Phân Tích & Chuẩn Bị', icon: <Database size={18} /> },
    { id: 'optimize', label: '2 · Tối Ưu & So Sánh', icon: <Zap size={18} /> },
    { id: 'export', label: '3 · Lịch Sử & Xuất Kết Quả', icon: <Download size={18} /> },
    { id: 'settings', label: 'Cấu Hình Hệ Thống', icon: <Settings size={18} /> },
    { id: 'guide', label: 'Tài Liệu Hướng Dẫn', icon: <HelpCircle size={18} /> },
  ];

  const itemsToRender = menuItems || defaultMenuItems;

  const handleItemClick = (item: LayoutMenuItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (onItemSelect) {
      onItemSelect(item.id);
    }
    closeSidebar();
  };

  return (
    <div className="testoptima-layout">
      {/* ══════════════ MOBILE OVERLAY BACKDROP ══════════════ */}
      {isMobile && (
        <div 
          className={`testoptima-backdrop ${sidebarOpen ? 'active' : ''}`} 
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* ══════════════ SIDEBAR (Fixed Left Panel) ══════════════ */}
      <aside className={`testoptima-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Header */}
        <div className="testoptima-sidebar-header">
          <div className="testoptima-brand-logo">
            <Layers size={18} />
          </div>
          <div>
            <h1 className="testoptima-brand-title">⚡ TESTFORGE</h1>
            <div className="testoptima-brand-tagline">Automated Test Data</div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="testoptima-sidebar-nav">
          <div className="testoptima-nav-label">Menu Điều Hướng</div>
          {itemsToRender.map((item) => {
            const isActive = activeItemId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`testoptima-nav-item ${
                  isActive ? 'testoptima-nav-item-active' : 'testoptima-nav-item-normal'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="testoptima-nav-item-icon">{item.icon}</span>
                <span className="testoptima-nav-item-text">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer User Details */}
        <div className="testoptima-sidebar-footer">
          <div className="testoptima-user-card">
            <div className="testoptima-user-avatar">
              {user.avatarInitials || user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="testoptima-user-info">
              <div className="testoptima-user-name" title={user.name}>{user.name}</div>
              <div className="testoptima-user-role" title={user.role}>{user.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══════════════ MAIN CONTENT CONTAINER ══════════════ */}
      <div className="testoptima-main">
        {/* Sticky Header */}
        <header className="testoptima-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Hamburger Button (visible on mobile only) */}
            <button 
              className="testoptima-menu-toggle" 
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? "Đóng menu" : "Mở menu"}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            {/* Header title */}
            <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>
              {headerTitle}
            </div>
          </div>

          {/* Right Header Controls (Actions / Profile / Status indicators) */}
          <div className="testoptima-header-actions">
            {headerRight}
          </div>
        </header>

        {/* Scrollable Content Wrapper */}
        <main className="testoptima-content-wrapper">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
