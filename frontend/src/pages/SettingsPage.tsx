import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/lib/theme';
import { DEFAULT_SETTINGS, loadSettingsFromStorage, applySettings, type UserSettings } from '@/lib/settings';
import { getCurrentAccount, logout } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Save, RotateCcw, HelpCircle, Shield, Lock, Clock, Eye, EyeOff, Key } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'system-ui', label: 'System UI' },
];

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeAppearanceTab, setActiveAppearanceTab] = useState<'typography' | 'colors'>('typography');
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Profile Settings State
  const [currentUser, setCurrentUser] = useState<any>(getCurrentAccount());
  const [profileData, setProfileData] = useState({
    two_factor_enabled: false,
    session_timeout_seconds: 3600,
    log_ip_addresses: false,
    account_code: '',
  });
  const [accountCode, setAccountCode] = useState('');
  const [accountCodeChanged, setAccountCodeChanged] = useState(false);
  const [sessionTimeoutValue, setSessionTimeoutValue] = useState(3600); // Unsaved value
  const [sessionTimeoutChanged, setSessionTimeoutChanged] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentSessionEndTime, setCurrentSessionEndTime] = useState<string>('');
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [twoFactorSetup, setTwoFactorSetup] = useState({
    qrCodeDataUrl: '',
    otpauthUrl: '',
    secret: '',
    manualKey: '',
    verificationCode: '',
  });
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [disable2FADialogOpen, setDisable2FADialogOpen] = useState(false);

  useEffect(() => {
    const loadedSettings = loadSettingsFromStorage();
    setSettings(loadedSettings);
    applySettings(loadedSettings);
    loadUserProfile();
    
    // Get session start time from localStorage (set on login)
    const sessionStart = localStorage.getItem('key-session-start-time');
    if (sessionStart) {
      setSessionStartTime(parseInt(sessionStart));
    } else {
      // If not set, set it now (for existing sessions)
      const now = Date.now();
      localStorage.setItem('key-session-start-time', now.toString());
      setSessionStartTime(now);
    }
  }, []);

  useEffect(() => {
    // Update current session end time display
    const updateSessionEndTime = () => {
      if (sessionStartTime && profileData.session_timeout_seconds) {
        const endTime = sessionStartTime + (profileData.session_timeout_seconds * 1000);
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining > 0) {
          setCurrentSessionEndTime(formatRelativeTime(remaining));
        } else {
          // Session expired - log out
          setCurrentSessionEndTime('Session expired');
          const account = getCurrentAccount();
          if (account) {
            logout();
            toast({
              variant: 'destructive',
              title: 'Session Expired',
              description: 'Your session has expired. Please log in again.',
            });
            setTimeout(() => {
              window.location.href = '/login';
            }, 1000);
          }
        }
      }
    };
    
    updateSessionEndTime();
    const interval = setInterval(updateSessionEndTime, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [sessionStartTime, profileData.session_timeout_seconds]);

  const loadUserProfile = async () => {
    const account = getCurrentAccount();
    if (account) {
      setCurrentUser(account);
      try {
        const res = await api.get('/account/profile', { params: { account_id: account.id } });
        const timeoutSeconds = res.data.session_timeout_seconds || 3600;
        setProfileData({
          two_factor_enabled: res.data.two_factor_enabled || false,
          session_timeout_seconds: timeoutSeconds,
          log_ip_addresses: res.data.log_ip_addresses || false,
          account_code: res.data.account_code || '',
        });
        setAccountCode(res.data.account_code || '');
        setAccountCodeChanged(false);
        setSessionTimeoutValue(timeoutSeconds);
        setSessionTimeoutChanged(false);
      } catch (error: any) {
        console.error('Failed to load account profile:', error);
      }
    }
  };
  
  const handleAccountCodeChange = (value: string) => {
    // Only allow lowercase letters and numbers
    const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6);
    setAccountCode(cleaned);
    setAccountCodeChanged(cleaned !== profileData.account_code);
  };
  
  const handleSaveAccountCode = async () => {
    if (accountCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Account code must be exactly 6 characters',
      });
      return;
    }
    
    try {
      await api.put('/account/account-code', {
        account_id: currentUser?.id,
        account_code: accountCode,
      });
      setProfileData({ ...profileData, account_code: accountCode });
      setAccountCodeChanged(false);
      toast({
        title: 'Success',
        description: 'Account code updated successfully',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update account code',
      });
    }
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    applySettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem('key-userSettings', JSON.stringify(settings));
    setHasChanges(false);
    setSavedDialogOpen(true);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  const handlePasswordChange = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'New passwords do not match',
      });
      return;
    }
    
    if (passwordForm.new_password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters long',
      });
      return;
    }
    
    try {
      await api.post('/account/change-password', {
        account_id: currentUser?.id,
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast({
        title: 'Success',
        description: 'Password changed successfully',
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to change password',
      });
    }
  };

  const handleGenerate2FA = async () => {
    try {
      const res = await api.post('/account/two-factor/generate', {
        account_id: currentUser?.id,
      });
      setTwoFactorSetup({
        qrCodeDataUrl: res.data.qr_code,
        otpauthUrl: res.data.otpauth_url,
        secret: res.data.secret,
        manualKey: res.data.manual_entry_key,
        verificationCode: '',
      });
      setTwoFactorDialogOpen(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to generate 2FA secret',
      });
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFactorSetup.verificationCode || twoFactorSetup.verificationCode.length !== 6) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a valid 6-digit code',
      });
      return;
    }
    
    try {
      await api.post('/account/two-factor/verify', {
        account_id: currentUser?.id,
        token: twoFactorSetup.verificationCode,
      });
      toast({
        title: 'Success',
        description: '2FA enabled successfully',
      });
      setTwoFactorDialogOpen(false);
      setTwoFactorSetup({ qrCodeDataUrl: '', otpauthUrl: '', secret: '', manualKey: '', verificationCode: '' });
      loadUserProfile();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Invalid verification code',
      });
    }
  };

  const handleDisable2FA = async () => {
    try {
      await api.post('/account/two-factor/disable', {
        account_id: currentUser?.id,
      });
      toast({
        title: 'Success',
        description: '2FA disabled successfully',
      });
      setDisable2FADialogOpen(false);
      loadUserProfile();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to disable 2FA',
      });
    }
  };

  const handleSessionTimeoutChange = (seconds: number) => {
    if (seconds < 120) {
      return;
    }
    setSessionTimeoutValue(seconds);
    setSessionTimeoutChanged(seconds !== profileData.session_timeout_seconds);
  };

  const handleSaveSessionTimeout = async () => {
    if (sessionTimeoutValue < 120) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Session timeout must be at least 120 seconds',
      });
      return;
    }
    
    try {
      await api.put('/account/session-timeout', {
        account_id: currentUser?.id,
        session_timeout_seconds: sessionTimeoutValue,
      });
      setProfileData({ ...profileData, session_timeout_seconds: sessionTimeoutValue });
      setSessionTimeoutChanged(false);
      toast({
        title: 'Success',
        description: 'Session timeout updated successfully',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update session timeout',
      });
    }
  };

  // HSL conversion functions
  const parseHSL = (hsl: string): [number, number, number] => {
    const parts = hsl.split(' ');
    return [
      parseFloat(parts[0]) || 0,
      parseFloat(parts[1]) || 0,
      parseFloat(parts[2]) || 0,
    ];
  };

  const formatHSL = (h: number, s: number, l: number): string => {
    return `${h} ${s}% ${l}%`;
  };

  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s / 100) * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const hexToHsl = (hex: string): [number, number, number] => {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  const ColorPicker = ({ label, value, onChange }: { label: string | React.ReactNode; value: string; onChange: (value: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const [h, s, l] = parseHSL(tempValue);
    const hexColor = hslToHex(h, s, l);

    useEffect(() => {
      if (isOpen) {
        setTempValue(value);
      }
    }, [isOpen, value]);

    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      const [newH, newS, newL] = hexToHsl(hex);
      setTempValue(formatHSL(newH, newS, newL));
    };

    const handleHSLChange = (newH?: number, newS?: number, newL?: number) => {
      setTempValue(formatHSL(newH ?? h, newS ?? s, newL ?? l));
    };

    const handleApply = () => {
      onChange(tempValue);
      setIsOpen(false);
    };

    const handleOpenChange = (open: boolean) => {
      if (!open) {
        setTempValue(value);
      }
      setIsOpen(open);
    };

    const [displayH, displayS, displayL] = parseHSL(value);
    const displayHex = hslToHex(displayH, displayS, displayL);

    return (
      <div className="space-y-2">
        {typeof label === 'string' ? <Label>{label}</Label> : label}
        <div className="flex gap-2 items-center">
          <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-16 h-12 rounded border border-border cursor-pointer"
                style={{ backgroundColor: displayHex, padding: '2px' }}
                onClick={() => setIsOpen(true)}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={hexColor}
                    onChange={handleColorInputChange}
                    className="w-20 h-12 rounded border border-border cursor-pointer"
                    style={{ padding: '2px' }}
                  />
                  <div
                    className="w-16 h-16 rounded border border-border"
                    style={{ backgroundColor: `hsl(${h}, ${s}%, ${l}%)` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">H</Label>
                    <Input
                      type="number"
                      min="0"
                      max="360"
                      value={h}
                      onChange={(e) => handleHSLChange(parseFloat(e.target.value) || 0, undefined, undefined)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">S</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={s}
                      onChange={(e) => handleHSLChange(undefined, parseFloat(e.target.value) || 0, undefined)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">L</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={l}
                      onChange={(e) => handleHSLChange(undefined, undefined, parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApply}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div
            className="w-12 h-12 rounded border border-border"
            style={{ backgroundColor: `hsl(${displayH}, ${displayS}%, ${displayL}%)` }}
          />
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">H</Label>
              <Input
                type="number"
                min="0"
                max="360"
                value={displayH}
                onChange={(e) => onChange(formatHSL(parseFloat(e.target.value) || 0, displayS, displayL))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">S</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={displayS}
                onChange={(e) => onChange(formatHSL(displayH, parseFloat(e.target.value) || 0, displayL))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-xs">L</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={displayL}
                onChange={(e) => onChange(formatHSL(displayH, displayS, parseFloat(e.target.value) || 0))}
                className="h-8"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    return `${Math.floor(seconds / 3600)} hours`;
  };

  const formatRelativeTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `in ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `in ${seconds} second${seconds > 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Settings</h2>
          <p className="text-muted-foreground">Customize your dashboard and manage your account</p>
        </div>
      </div>

      <Tabs defaultValue="customization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customization">Customization</TabsTrigger>
          <TabsTrigger value="profile">Profile Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="customization" className="space-y-4">
          <div className="flex items-center justify-end mb-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          {/* Theme */}
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred theme mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme Mode</Label>
                  <p className="text-sm text-muted-foreground">Choose between light, dark, or system</p>
                </div>
                <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {theme === 'system' && (
                <p className="text-sm text-muted-foreground">
                  Current system theme: <span className="font-medium">{resolvedTheme}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Border Radius */}
          <Card>
            <CardHeader>
              <CardTitle>Border Radius</CardTitle>
              <CardDescription>Adjust the roundness of UI elements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Radius: {settings.borderRadius}px</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Adjust the border radius of UI elements like buttons, cards, and inputs. 
                            Higher values create more rounded corners. Range: 0-24px.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={settings.borderRadius}
                    onChange={(e) => updateSetting('borderRadius', parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </div>
                <Slider
                  value={[settings.borderRadius]}
                  onValueChange={(value) => updateSetting('borderRadius', value[0])}
                  min={0}
                  max={24}
                  step={1}
                  className="w-full"
                />
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Sharp</span>
                  <span className="ml-auto">Rounded</span>
                </div>
              </div>
              <div className="p-4 border rounded-lg" style={{ borderRadius: `${settings.borderRadius}px` }}>
                <p className="text-sm">Preview: This is how elements will look with the selected border radius.</p>
              </div>
            </CardContent>
          </Card>

          {/* Typography and Colors Tabs */}
          <Tabs value={activeAppearanceTab} onValueChange={(value) => setActiveAppearanceTab(value as 'typography' | 'colors')} className="space-y-4">
            <TabsList>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
            </TabsList>
            
            <TabsContent value="typography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Font Family</CardTitle>
                  <CardDescription>Choose the font family for the application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Font Family</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Choose the font family that will be used throughout the dashboard. 
                              The selected font will be applied to all text elements.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select value={settings.fontFamily} onValueChange={(value) => updateSetting('fontFamily', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-4 border rounded-lg" style={{ fontFamily: settings.fontFamily }}>
                    <p className="text-lg font-medium">Sample Text</p>
                    <p className="text-sm text-muted-foreground">
                      This is how the font will appear throughout the application.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="colors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Color Palette</CardTitle>
                  <CardDescription>Customize the color scheme of the application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <ColorPicker
                      label={
                        <div className="flex items-center gap-2">
                          <span>Primary Color</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  The primary color is used for buttons, links, and other interactive elements. 
                                  This is the main brand color of your dashboard.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      }
                      value={settings.primary}
                      onChange={(value) => updateSetting('primary', value)}
                    />
                  </div>
                  <ColorPicker
                    label={
                      <div className="flex items-center gap-2">
                        <span>Secondary Color</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                The secondary color is used for secondary buttons and background elements.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.secondary}
                    onChange={(value) => updateSetting('secondary', value)}
                  />
                  <ColorPicker
                    label={
                      <div className="flex items-center gap-2">
                        <span>Accent Color</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                The accent color is used for hover states, highlights, and subtle UI accents.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.accent}
                    onChange={(value) => updateSetting('accent', value)}
                  />
                  <ColorPicker
                    label={
                      <div className="flex items-center gap-2">
                        <span>Destructive Color</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                The destructive color is used for delete buttons and dangerous actions.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.destructive}
                    onChange={(value) => updateSetting('destructive', value)}
                  />
                  <ColorPicker
                    label={
                      <div className="flex items-center gap-2">
                        <span>Muted Color</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                The muted color is used for disabled states, borders, and subtle backgrounds.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.muted}
                    onChange={(value) => updateSetting('muted', value)}
                  />

                  <div className="pt-4 border-t space-y-2">
                    <Label>Color Preview</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center"
                        style={{ backgroundColor: `hsl(${settings.primary})`, color: 'white' }}
                      >
                        Primary
                      </div>
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center border"
                        style={{ backgroundColor: `hsl(${settings.secondary})` }}
                      >
                        Secondary
                      </div>
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center border"
                        style={{ backgroundColor: `hsl(${settings.accent})` }}
                      >
                        Accent
                      </div>
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center"
                        style={{ backgroundColor: `hsl(${settings.destructive})`, color: 'white' }}
                      >
                        Destructive
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          {currentUser && (
            <>
              {/* Password Change */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      <div>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Update your account password</CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={handlePasswordChange}
                      disabled={
                        !passwordForm.current_password || 
                        !passwordForm.new_password || 
                        !passwordForm.confirm_password ||
                        passwordForm.new_password.length < 8
                      }
                    >
                      Change Password
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(e); }} className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">Current Password *</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">New Password *</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Password must be at least 8 characters long</p>
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm New Password *</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                        required
                      />
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Two-Factor Authentication */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <CardTitle>Two-Factor Authentication</CardTitle>
                  </div>
                  <CardDescription>Add an extra layer of security to your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Status</p>
                      <p className="text-sm text-muted-foreground">
                        {profileData.two_factor_enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    {profileData.two_factor_enabled ? (
                      <Button
                        variant="destructive"
                        onClick={() => setDisable2FADialogOpen(true)}
                      >
                        Disable 2FA
                      </Button>
                    ) : (
                      <Button onClick={handleGenerate2FA}>
                        Enable 2FA
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* IP Address Logging */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      <div>
                        <CardTitle>IP Address Logging</CardTitle>
                        <CardDescription>Control whether IP addresses are logged in request logs</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant={profileData.log_ip_addresses ? "default" : "outline"}
                      onClick={async () => {
                        try {
                          await api.put('/account/ip-logging', {
                            account_id: currentUser?.id,
                            log_ip_addresses: !profileData.log_ip_addresses,
                          });
                          setProfileData({
                            ...profileData,
                            log_ip_addresses: !profileData.log_ip_addresses,
                          });
                          toast({
                            title: 'Success',
                            description: `IP address logging ${!profileData.log_ip_addresses ? 'enabled' : 'disabled'}`,
                          });
                        } catch (error: any) {
                          toast({
                            variant: 'destructive',
                            title: 'Error',
                            description: error.response?.data?.error || 'Failed to update IP logging setting',
                          });
                        }
                      }}
                    >
                      {profileData.log_ip_addresses ? (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Disabled
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {profileData.log_ip_addresses
                      ? 'IP addresses are being logged in request logs. This helps with security monitoring and debugging.'
                      : 'IP addresses are not being logged. When disabled, the IP address column will show "DISABLED" in logs.'}
                  </p>
                </CardContent>
              </Card>

              {/* Account Code */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      <div>
                        <CardTitle>Account Code</CardTitle>
                        <CardDescription>Your unique account identifier (used in API keys)</CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveAccountCode}
                      disabled={!accountCodeChanged || accountCode.length !== 6}
                    >
                      Save Account Code
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-code">Account Code *</Label>
                    <Input
                      id="account-code"
                      type="text"
                      value={accountCode}
                      onChange={(e) => handleAccountCodeChange(e.target.value)}
                      placeholder="abcdef"
                      maxLength={6}
                      className="font-mono"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be exactly 6 lowercase letters or numbers. This code is used in your API keys.
                    </p>
                  </div>
                  {accountCodeChanged && (
                    <p className="text-sm text-muted-foreground">
                      Changes will apply to new API keys. Existing keys will not be affected.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Session Timeout */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <div>
                        <CardTitle>Session Timeout</CardTitle>
                        <CardDescription>Set how long your session should last before logging you out</CardDescription>
                      </div>
                    </div>
                    <Button 
                      onClick={handleSaveSessionTimeout}
                      disabled={!sessionTimeoutChanged}
                    >
                      Save Session Timeout
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>Timeout: {formatTime(sessionTimeoutValue)}</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">
                                After this time of inactivity, you will be automatically logged out. 
                                Minimum: 120 seconds (2 minutes).
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        type="number"
                        min="120"
                        value={sessionTimeoutValue}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 120;
                          if (value >= 120) {
                            handleSessionTimeoutChange(value);
                          }
                        }}
                        className="w-32"
                      />
                    </div>
                    <Slider
                      value={[sessionTimeoutValue]}
                      onValueChange={(value) => {
                        const seconds = Math.max(120, value[0]);
                        handleSessionTimeoutChange(seconds);
                      }}
                      min={120}
                      max={86400}
                      step={60}
                      className="w-full"
                    />
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>2 min</span>
                      <span className="ml-auto">24 hours</span>
                    </div>
                  </div>
                  {sessionTimeoutChanged && (
                    <p className="text-sm text-muted-foreground">
                      Changes will apply from your next session.
                    </p>
                  )}
                  {currentSessionEndTime && !sessionTimeoutChanged && (
                    <div className="pt-2 border-t">
                      <p className="text-sm">
                        <span className="font-medium">Current session ends:</span>{' '}
                        <span className="text-muted-foreground">{currentSessionEndTime}</span>
                      </p>
                    </div>
                  )}
                  {sessionTimeoutChanged && sessionStartTime && profileData.session_timeout_seconds && (
                    <div className="pt-2 border-t">
                      <p className="text-sm">
                        <span className="font-medium">Current session ends:</span>{' '}
                        <span className="text-muted-foreground">
                          {(() => {
                            const endTime = sessionStartTime + (profileData.session_timeout_seconds * 1000);
                            const remaining = endTime - Date.now();
                            return remaining > 0 ? formatRelativeTime(remaining) : 'Session expired';
                          })()}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        (New timeout will apply from next login)
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFactorDialogOpen} onOpenChange={setTwoFactorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {twoFactorSetup.otpauthUrl && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <QRCodeSVG value={twoFactorSetup.otpauthUrl} size={200} />
                </div>
              </div>
            )}
            {twoFactorSetup.manualKey && (
              <div>
                <Label>Manual Entry Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={twoFactorSetup.manualKey}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(twoFactorSetup.manualKey);
                      toast({
                        title: 'Copied',
                        description: 'Manual entry key copied to clipboard',
                      });
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use this key if you cannot scan the QR code
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="verification-code">Enter Verification Code *</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={twoFactorSetup.verificationCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setTwoFactorSetup({ ...twoFactorSetup, verificationCode: value });
                }}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-widest"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFactorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerify2FA} disabled={twoFactorSetup.verificationCode.length !== 6}>
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={disable2FADialogOpen} onOpenChange={setDisable2FADialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable two-factor authentication? This will reduce the security of your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDisable2FADialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisable2FA}>
              Disable 2FA
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Saved Confirmation Dialog */}
      <AlertDialog open={savedDialogOpen} onOpenChange={setSavedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Settings Saved</AlertDialogTitle>
            <AlertDialogDescription>
              Your dashboard settings have been saved successfully.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSavedDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
