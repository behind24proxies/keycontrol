import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Shield,
  ShieldCheck,
  Gauge,
  Folder,
  FileText,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight,
  Network,
  SlidersHorizontal,
  Key,
  LayoutDashboard,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";
import { isLoggedIn, logout } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";
// No formatters import needed — docs are served on the same origin
// @ts-ignore
import logoDark from "@/assets/keycontrol-nobg-dark-theme.png";
// @ts-ignore
import logoLight from "@/assets/keycontrol-nobg-light-theme.png";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/resources", label: "Resources", icon: Folder },
  { href: "/presets", label: "Presets", icon: SlidersHorizontal },
  { href: "/api-keys", label: "API Keys", icon: Key },
  {
    type: "group",
    label: "IP Ranges",
    icon: Network,
    children: [
      { href: "/ip-blocklists", label: "IP Blocklists", icon: Shield },
      { href: "/ip-allowlists", label: "IP Allowlists", icon: ShieldCheck },
    ],
  },
  { href: "/rate-limits", label: "Rate Limits", icon: Gauge },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

const menuItemDescriptions: Record<string, string> = {
  "/dashboard": "Overview of your KeyControl gateway",
  "/resources": "Manage your API resources and configure endpoints",
  "/api-keys": "Create and manage API keys with preset access control",
  "/presets": "Manage access control presets for API keys",
  "/ip-blocklists": "Create and manage IP blocklists to restrict access",
  "/ip-allowlists": "Create and manage IP allowlists to whitelist trusted IPs",
  "/rate-limits": "Configure rate limiting rules for API keys",
  "/logs": "View request and response logs for all API keys",
  "/settings": "Customize dashboard appearance and preferences",
};

export function Sidebar() {
  const location = useLocation();
  const { setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    const stored = localStorage.getItem("key-sidebar-minimized");
    return stored === "true";
  });

  const [ipRangesOpen, setIpRangesOpen] = useState(() => {
    const stored = localStorage.getItem("key-ip-ranges-open");
    return stored !== "false";
  });

  useEffect(() => {
    localStorage.setItem("key-sidebar-minimized", String(sidebarMinimized));
    window.dispatchEvent(new Event("sidebar-toggle"));
  }, [sidebarMinimized]);

  useEffect(() => {
    localStorage.setItem("key-ip-ranges-open", String(ipRangesOpen));
  }, [ipRangesOpen]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Signed out",
      description: "You have been signed out",
    });
    window.location.href = "/login";
  };

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const isIPRangesActive =
    location.pathname === "/ip-blocklists" ||
    location.pathname === "/ip-allowlists";

  const loggedIn = isLoggedIn();

  return (
    <TooltipProvider>
      <SidebarPrimitive
        className={cn(
          "border-r bg-card h-screen fixed left-0 top-0 flex flex-col transition-[width] duration-300 ease-in-out",
          sidebarMinimized ? "w-16" : "w-56",
        )}
      >
        <div
          className={cn(
            "p-4 border-b flex-shrink-0 flex items-center",
            sidebarMinimized ? "px-0 justify-center" : "justify-between",
          )}
        >
          {!sidebarMinimized && (
            <img
              src={resolvedTheme === "dark" ? logoDark : logoLight}
              alt="KeyControl"
              className="h-8 w-auto object-contain"
            />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarMinimized(!sidebarMinimized)}
              >
                {sidebarMinimized ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarMinimized ? "Expand sidebar" : "Minimize sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
        <SidebarContent className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden no-scrollbar no-scroll-anchor min-h-0",
          sidebarMinimized ? "p-1" : "p-3",
        )}>
          <div className="space-y-1">
            {menuItems.map((item) => {
              if (item.type === "group") {
                if (sidebarMinimized) {
                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>
                        <SidebarItem
                          active={isIPRangesActive}
                          className="flex items-center justify-center !px-0"
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                        </SidebarItem>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <div>
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {item.children?.map((child) => (
                              <div key={child.href}>{child.label}</div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      onClick={() => setIpRangesOpen(!ipRangesOpen)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                        isIPRangesActive
                          ? "bg-accent text-foreground dark:bg-[hsl(240_3.7%_25%)] dark:text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground dark:hover:bg-accent/25 dark:hover:text-foreground/90",
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 whitespace-nowrap overflow-hidden">
                        {item.label}
                      </span>
                      {ipRangesOpen ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                    </button>
                    {ipRangesOpen && item.children && (
                      <div className="ml-4 space-y-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive =
                            location.pathname === child.href;
                          return (
                            <Link key={child.href} to={child.href}>
                              <SidebarItem
                                active={isChildActive}
                                className="flex items-center gap-2 transition-all duration-300"
                              >
                                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="whitespace-nowrap overflow-hidden">
                                  {child.label}
                                </span>
                              </SidebarItem>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular menu item
              const Icon = item.icon;
              const isActive =
                location.pathname === item.href ||
                (item.href === "/dashboard" && location.pathname === "/");
              const content = (
                <Link key={item.href} to={item.href!}>
                  <SidebarItem
                    active={isActive}
                    data-tour={item.href!.replace('/', '')}
                    className={cn(
                      "flex items-center gap-2 transition-all duration-300",
                      sidebarMinimized ? "justify-center !px-0" : "",
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!sidebarMinimized && (
                      <span className="whitespace-nowrap overflow-hidden">
                        {item.label}
                      </span>
                    )}
                  </SidebarItem>
                </Link>
              );

              if (sidebarMinimized) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {menuItemDescriptions[item.href!] || ""}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return content;
            })}
          </div>
        </SidebarContent>
        <div
          className={cn(
            "p-4 border-t flex-shrink-0 space-y-2",
            sidebarMinimized && "px-1",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full",
                  sidebarMinimized ? "justify-center !px-0" : "justify-start",
                )}
                onClick={handleThemeToggle}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {!sidebarMinimized && (
                  <span className="ml-2">
                    {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            {sidebarMinimized && (
              <TooltipContent side="right">
                {resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"}
              </TooltipContent>
            )}
          </Tooltip>
          <div className="mt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="/docs#tag/quick-start"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full",
                    sidebarMinimized ? "justify-center !px-0" : "justify-start",
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  {!sidebarMinimized && (
                    <span className="ml-2 flex items-center gap-1">
                      API Docs
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </span>
                  )}
                </Button>
              </a>
            </TooltipTrigger>
            {sidebarMinimized && (
              <TooltipContent side="right">
                View API documentation
              </TooltipContent>
            )}
          </Tooltip>
          </div>
          {loggedIn && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full",
                    sidebarMinimized ? "justify-center !px-0" : "justify-start",
                  )}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  {!sidebarMinimized && <span className="ml-2">Logout</span>}
                </Button>
              </TooltipTrigger>
              {sidebarMinimized && (
                <TooltipContent side="right">
                  Logout from the application
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
      </SidebarPrimitive>
    </TooltipProvider>
  );
}
