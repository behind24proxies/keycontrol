import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar } from '@/components/Sidebar';
import { Toaster } from '@/components/ui/toaster';
import LoginPage from '@/pages/LoginPage';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import UsersPage from '@/pages/UsersPage';
import IPBlocklistsPage from '@/pages/IPBlocklistsPage';
import IPAllowlistsPage from '@/pages/IPAllowlistsPage';
import RateLimitsPage from '@/pages/RateLimitsPage';
import LogsPage from '@/pages/LogsPage';
import SettingsPage from '@/pages/SettingsPage';
import { applySettingsFromStorage } from '@/lib/settings';
import { getCurrentAccount, logout } from '@/lib/auth';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const account = getCurrentAccount();
  
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('key-sidebar-minimized');
      return stored === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Load and apply settings on mount
    applySettingsFromStorage();
    
    const handleSidebarToggle = () => {
      const stored = localStorage.getItem('key-sidebar-minimized');
      setSidebarMinimized(stored === 'true');
    };
    
    // Listen to custom event for same-tab updates
    window.addEventListener('sidebar-toggle', handleSidebarToggle);
    
    // Also listen to storage events for cross-tab updates
    window.addEventListener('storage', (e) => {
      if (e.key === 'key-sidebar-minimized') {
        handleSidebarToggle();
      }
      // Reload settings when they change
      if (e.key === 'key-userSettings') {
        applySettingsFromStorage();
      }
    });
    
    // Check session expiration periodically
    const checkSessionExpiration = () => {
      const account = getCurrentAccount();
      if (!account) return;
      
      const sessionStart = localStorage.getItem('key-session-start-time');
      if (!sessionStart) return;
      
      const sessionTimeout = account.session_timeout_seconds || 3600;
      const sessionStartTime = parseInt(sessionStart);
      const endTime = sessionStartTime + (sessionTimeout * 1000);
      const now = Date.now();
      
      if (now >= endTime) {
        // Session expired
        logout();
        window.location.href = '/login';
      }
    };
    
    // Check every 5 seconds
    const sessionCheckInterval = setInterval(checkSessionExpiration, 5000);
    
    return () => {
      window.removeEventListener('sidebar-toggle', handleSidebarToggle);
      window.removeEventListener('storage', handleSidebarToggle);
      clearInterval(sessionCheckInterval);
    };
  }, []);

  if (isLoginPage) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div 
        className="flex-1 transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: sidebarMinimized ? '4rem' : '14rem' }}
      >
        <Routes>
          <Route path="/" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/ip-blocklists" element={<ProtectedRoute><IPBlocklistsPage /></ProtectedRoute>} />
          <Route path="/ip-allowlists" element={<ProtectedRoute><IPAllowlistsPage /></ProtectedRoute>} />
          <Route path="/rate-limits" element={<ProtectedRoute><RateLimitsPage /></ProtectedRoute>} />
          <Route path="/logs" element={<ProtectedRoute><LogsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="key-keysplitter-ui-theme">
      <TooltipProvider>
        <BrowserRouter>
          <AppContent />
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
