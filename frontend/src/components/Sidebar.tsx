import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
  Users,
  LogIn,
  ChevronDown,
  ChevronRight,
  Network
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar as SidebarPrimitive, SidebarContent, SidebarItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/lib/theme';
import { getCurrentAccount, logout, type CurrentAccount } from '@/lib/auth';
import api from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import logoDark from '@/assets/keycontrol-nobg-dark-theme.png';
import logoLight from '@/assets/keycontrol-nobg-light-theme.png';

const menuItems = [
  { href: '/', label: 'APIs', icon: Folder },
  { href: '/users', label: 'Users', icon: Users },
  { 
    type: 'group',
    label: 'IP Ranges',
    icon: Network,
    children: [
      { href: '/ip-blocklists', label: 'IP Blocklists', icon: Shield },
      { href: '/ip-allowlists', label: 'IP Allowlists', icon: ShieldCheck },
    ]
  },
  { href: '/rate-limits', label: 'Rate Limits', icon: Gauge },
  { href: '/logs', label: 'Logs', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [sidebarMinimized, setSidebarMinimized] = useState(() => {
    const stored = localStorage.getItem('key-sidebar-minimized');
    return stored === 'true';
  });
  const [currentAccount, setCurrentAccountState] = useState<CurrentAccount | null>(getCurrentAccount());
  const [ipRangesOpen, setIpRangesOpen] = useState(() => {
    const stored = localStorage.getItem('key-ip-ranges-open');
    return stored !== 'false'; // Default to open
  });

  useEffect(() => {
    localStorage.setItem('key-sidebar-minimized', String(sidebarMinimized));
    // Dispatch custom event for App.tsx to listen to
    window.dispatchEvent(new Event('sidebar-toggle'));
  }, [sidebarMinimized]);

  useEffect(() => {
    localStorage.setItem('key-ip-ranges-open', String(ipRangesOpen));
  }, [ipRangesOpen]);

  useEffect(() => {
    const handleAccountChange = () => {
      setCurrentAccountState(getCurrentAccount());
    };
    window.addEventListener('account-changed', handleAccountChange);
    return () => window.removeEventListener('account-changed', handleAccountChange);
  }, []);

  const handleLogout = () => {
    logout();
    toast({
      title: 'Signed out',
      description: 'You have been signed out',
    });
    window.location.href = '/login';
  };

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const menuItemDescriptions: Record<string, string> = {
    '/': 'Manage your API gateway APIs and configure endpoints',
    '/users': 'Create and manage users that can be assigned to API keys',
    '/ip-blocklists': 'Create and manage IP blocklists to restrict access',
    '/ip-allowlists': 'Create and manage IP allowlists to whitelist trusted IPs',
    '/rate-limits': 'Configure rate limiting rules for API keys',
    '/logs': 'View request and response logs for all API keys',
    '/settings': 'Customize dashboard appearance and preferences',
  };
  
  const isIPRangesActive = location.pathname === '/ip-blocklists' || location.pathname === '/ip-allowlists';

  return (
    <TooltipProvider>
      <SidebarPrimitive 
        className={cn(
          "border-r bg-card h-screen fixed left-0 top-0 flex flex-col transition-[width] duration-300 ease-in-out",
          sidebarMinimized ? 'w-16' : 'w-56'
        )}
      >
        <div className={cn("p-4 border-b flex-shrink-0 flex items-center justify-between", sidebarMinimized && 'px-2')}>
          {!sidebarMinimized && (
            <img 
              src={resolvedTheme === 'dark' ? logoDark : logoLight}
              alt="KeySplitter"
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
              {sidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>
        <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar no-scroll-anchor min-h-0 p-3">
          <div className="space-y-1">
            {menuItems.map((item) => {
              if (item.type === 'group') {
                // Render collapsible group
                if (sidebarMinimized) {
                  // When minimized, show parent as tooltip
                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>
                        <SidebarItem
                          active={isIPRangesActive}
                          className="justify-center px-2"
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
                
                // Expanded view with collapsible group
                return (
                  <div key={item.label} className="space-y-1">
                    <button
                      onClick={() => setIpRangesOpen(!ipRangesOpen)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                        isIPRangesActive
                          ? "bg-accent text-foreground dark:bg-[hsl(240_3.7%_25%)] dark:text-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground dark:hover:bg-accent/25 dark:hover:text-foreground/90"
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 whitespace-nowrap overflow-hidden">{item.label}</span>
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
                          const isChildActive = location.pathname === child.href;
                          return (
                            <Link key={child.href} to={child.href}>
                              <SidebarItem
                                active={isChildActive}
                                className="flex items-center gap-2 transition-all duration-300"
                              >
                                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                <span className="whitespace-nowrap overflow-hidden">{child.label}</span>
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
              const isActive = location.pathname === item.href;
              const content = (
                <Link key={item.href} to={item.href}>
                  <SidebarItem
                    active={isActive}
                    className={cn(
                      "flex items-center gap-2 transition-all duration-300",
                      sidebarMinimized ? 'justify-center px-2' : ''
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!sidebarMinimized && (
                      <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                    )}
                  </SidebarItem>
                </Link>
              );

              if (sidebarMinimized) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      {content}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {menuItemDescriptions[item.href] || ''}
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
        <div className={cn("p-4 border-t flex-shrink-0 space-y-2", sidebarMinimized && 'px-2')}>
          {currentAccount && (
            <div className={cn(
              "mb-2 p-2 rounded-md bg-muted/50",
              sidebarMinimized && 'p-1'
            )}>
              {!sidebarMinimized ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {currentAccount.username}
                    </p>
                  </div>
                </div>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-3 h-3 rounded-full mx-auto bg-primary" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="font-medium">{currentAccount.username}</div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={cn(
                  "w-full",
                  sidebarMinimized ? 'justify-center px-2' : 'justify-start'
                )}
                onClick={handleThemeToggle}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {!sidebarMinimized && (
                  <span className="ml-2">{resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                )}
              </Button>
            </TooltipTrigger>
            {sidebarMinimized && (
              <TooltipContent side="right">
                {resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              </TooltipContent>
            )}
          </Tooltip>
          {currentAccount && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "w-full",
                    sidebarMinimized ? 'justify-center px-2' : 'justify-start'
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
