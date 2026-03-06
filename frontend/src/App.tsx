import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ProjectsPage from "@/pages/ProjectsPage";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import IPBlocklistsPage from "@/pages/IPBlocklistsPage";
import IPAllowlistsPage from "@/pages/IPAllowlistsPage";
import RateLimitsPage from "@/pages/RateLimitsPage";
import LogsPage from "@/pages/LogsPage";
import SettingsPage from "@/pages/SettingsPage";
import PresetsPage from "@/pages/PresetsPage";
import KeyCasesPage from "@/pages/KeyCasesPage";
import DashboardPage from "@/pages/DashboardPage";
import ProductTour, { TOUR_DONE_KEY } from "@/components/ProductTour";
import InteractiveDemoTour, { loadTourProgress } from "@/components/InteractiveDemoTour";
import { applySettingsFromStorage } from "@/lib/settings";
import { isLoggedIn } from "@/lib/auth";

// Protected Route Component — all routes require admin JWT
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login" || location.pathname === "/reset-password";
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("key-sidebar-minimized");
      return stored === "true";
    }
    return false;
  });
  const [tourActive, setTourActive] = useState(false);
  const [demoTourActive, setDemoTourActive] = useState(() => {
    // Auto-resume demo tour if progress was saved before a refresh
    return isLoggedIn() && !isLoginPage && loadTourProgress() !== null;
  });

  useEffect(() => {
    // Load and apply settings on mount
    applySettingsFromStorage();

    const handleSidebarToggle = () => {
      const stored = localStorage.getItem("key-sidebar-minimized");
      setSidebarMinimized(stored === "true");
    };

    window.addEventListener("sidebar-toggle", handleSidebarToggle);

    window.addEventListener("storage", (e) => {
      if (e.key === "key-sidebar-minimized") {
        handleSidebarToggle();
      }
      if (e.key === "key-userSettings") {
        applySettingsFromStorage();
      }
    });

    // Re-apply settings when theme class changes
    const themeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          applySettingsFromStorage();
        }
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
      window.removeEventListener("storage", handleSidebarToggle);
      themeObserver.disconnect();
    };
  }, []);

  // Listen for manual trigger from settings (stable, mount-only)
  useEffect(() => {
    const handler = () => setTourActive(true);
    const demoHandler = () => setDemoTourActive(true);
    window.addEventListener("trigger-onboarding", handler);
    window.addEventListener("trigger-demo-tour", demoHandler);
    return () => {
      window.removeEventListener("trigger-onboarding", handler);
      window.removeEventListener("trigger-demo-tour", demoHandler);
    };
  }, []);

  // Auto-trigger tour on first visit (re-evaluates after login navigation)
  useEffect(() => {
    if (isLoggedIn() && !isLoginPage && !localStorage.getItem(TOUR_DONE_KEY)) {
      const timer = setTimeout(() => setTourActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className="flex-1 transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: sidebarMinimized ? "4rem" : "14rem" }}
      >
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resources/:id"
            element={
              <ProtectedRoute>
                <ProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-keys"
            element={
              <ProtectedRoute>
                <KeyCasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/presets"
            element={
              <ProtectedRoute>
                <PresetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ip-blocklists"
            element={
              <ProtectedRoute>
                <IPBlocklistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ip-allowlists"
            element={
              <ProtectedRoute>
                <IPAllowlistsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rate-limits"
            element={
              <ProtectedRoute>
                <RateLimitsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <LogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ProductTour active={tourActive} onFinish={() => setTourActive(false)} />
        <InteractiveDemoTour active={demoTourActive} onFinish={() => setDemoTourActive(false)} />
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
