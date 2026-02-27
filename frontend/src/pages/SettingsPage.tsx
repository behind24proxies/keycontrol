import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";
import {
  DEFAULT_SETTINGS,
  loadSettingsFromStorage,
  applySettings,
  type UserSettings,
} from "@/lib/settings";

import { useToast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import {
  Save,
  RotateCcw,
  HelpCircle,
  Shield,
  Clock,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Rocket,
  Globe,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Poppins", label: "Poppins" },
  { value: "Source Sans Pro", label: "Source Sans Pro" },
  { value: "Raleway", label: "Raleway" },
  { value: "Nunito", label: "Nunito" },
  { value: "system-ui", label: "System UI" },
];

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeAppearanceTab, setActiveAppearanceTab] = useState<
    "typography" | "colors"
  >("typography");
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const [orgCodeConfirmDialogOpen, setOrgCodeConfirmDialogOpen] = useState(false);

  // Organization Settings State
  const [organizationCode, setOrganizationCode] = useState("");
  const [organizationCodeChanged, setOrganizationCodeChanged] = useState(false);
  const [profileData, setProfileData] = useState({
    two_factor_enabled: false,
    session_timeout_seconds: 3600,
    log_ip_addresses: false,
    organization_code: "",
    master_api_key_prefix: "" as string | null,
  });
  const [sessionTimeoutValue, setSessionTimeoutValue] = useState(3600);
  const [sessionTimeoutChanged, setSessionTimeoutChanged] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState({
    qrCodeDataUrl: "",
    otpauthUrl: "",
    secret: "",
    manualKey: "",
    verificationCode: "",
  });
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [disable2FADialogOpen, setDisable2FADialogOpen] = useState(false);
  const [disable2FACode, setDisable2FACode] = useState("");

  // Master API Key State
  const [masterKeyRevealed, setMasterKeyRevealed] = useState("");
  const [masterKeyVisible, setMasterKeyVisible] = useState(false);
  const [masterKeyGenerating, setMasterKeyGenerating] = useState(false);
  const [masterKeyCopied, setMasterKeyCopied] = useState(false);
  const [masterKeyConfirmAction, setMasterKeyConfirmAction] = useState<"generate" | "revoke" | null>(null);

  useEffect(() => {
    const loadedSettings = loadSettingsFromStorage();
    setSettings(loadedSettings);
    applySettings(loadedSettings);
    loadOrgProfile();
  }, []);

  const loadOrgProfile = async () => {
    try {
      const res = await api.get("/organization/profile");
      const timeoutSeconds = res.data.session_timeout_seconds || 3600;
      setProfileData({
        two_factor_enabled: res.data.two_factor_enabled || false,
        session_timeout_seconds: timeoutSeconds,
        log_ip_addresses: res.data.log_ip_addresses || false,
        organization_code: res.data.organization_code || "",
        master_api_key_prefix: res.data.master_api_key_prefix || null,
      });
      setOrganizationCode(res.data.organization_code || "");
      setOrganizationCodeChanged(false);
      setSessionTimeoutValue(timeoutSeconds);
      setSessionTimeoutChanged(false);
    } catch (error: any) {
      console.error("Failed to load organization profile:", error);
    }
  };

  const handleOrganizationCodeChange = (value: string) => {
    // Only allow lowercase letters and numbers
    const cleaned = value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 6);
    setOrganizationCode(cleaned);
    setOrganizationCodeChanged(cleaned !== profileData.organization_code);
  };

  const handleSaveOrganizationCode = async () => {
    if (organizationCode.length !== 6) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Organization code must be exactly 6 characters",
      });
      return;
    }
    if (saving) return;
    setSaving(true);

    try {
      await api.put("/organization/organization-code", {
        organization_code: organizationCode,
      });
      setProfileData({ ...profileData, organization_code: organizationCode });
      setOrganizationCodeChanged(false);
      toast({
        title: "Success",
        description: "Organization code updated successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Failed to update organization code",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    applySettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem("key-userSettings", JSON.stringify(settings));
    setHasChanges(false);
    setSavedDialogOpen(true);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    applySettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  };

  const handleGenerate2FA = async () => {
    try {
      const res = await api.post("/organization/two-factor/generate");
      setTwoFactorSetup({
        qrCodeDataUrl: res.data.qr_code,
        otpauthUrl: res.data.otpauth_url,
        secret: res.data.secret,
        manualKey: res.data.manual_entry_key,
        verificationCode: "",
      });
      setTwoFactorDialogOpen(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to generate 2FA secret",
      });
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFactorSetup.verificationCode || twoFactorSetup.verificationCode.length !== 6) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid 6-digit code" });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await api.post("/organization/two-factor/verify", { token: twoFactorSetup.verificationCode });
      toast({ title: "Success", description: "2FA enabled successfully" });
      setTwoFactorDialogOpen(false);
      setTwoFactorSetup({ qrCodeDataUrl: "", otpauthUrl: "", secret: "", manualKey: "", verificationCode: "" });
      loadOrgProfile();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Invalid verification code" });
    } finally {
      setSaving(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disable2FACode || disable2FACode.length !== 6) {
      toast({ variant: "destructive", title: "Error", description: "Please enter your 6-digit 2FA code" });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await api.post("/organization/two-factor/disable", { token: disable2FACode });
      toast({ title: "Success", description: "2FA disabled successfully" });
      setDisable2FADialogOpen(false);
      setDisable2FACode("");
      loadOrgProfile();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Failed to disable 2FA" });
    } finally {
      setSaving(false);
    }
  };

  const handleSessionTimeoutChange = (seconds: number) => {
    if (seconds < 120) return;
    setSessionTimeoutValue(seconds);
    setSessionTimeoutChanged(seconds !== profileData.session_timeout_seconds);
  };

  const handleSaveSessionTimeout = async () => {
    if (sessionTimeoutValue < 120) {
      toast({ variant: "destructive", title: "Error", description: "Session timeout must be at least 120 seconds" });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await api.put("/organization/session-timeout", { session_timeout_seconds: sessionTimeoutValue });
      setProfileData({ ...profileData, session_timeout_seconds: sessionTimeoutValue });
      setSessionTimeoutChanged(false);
      toast({ title: "Success", description: "Session timeout updated successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.response?.data?.error || "Failed to update session timeout" });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    if (remainingMinutes === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours}h ${remainingMinutes}m`;
  };


  // HSL conversion functions
  const parseHSL = (hsl: string): [number, number, number] => {
    const parts = hsl.split(" ");
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
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const hexToHsl = (hex: string): [number, number, number] => {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0,
      l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  };

  const ColorPicker = ({
    label,
    value,
    onChange,
  }: {
    label: string | React.ReactNode;
    value: string;
    onChange: (value: string) => void;
  }) => {
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
        {typeof label === "string" ? <Label>{label}</Label> : label}
        <div className="flex gap-2 items-center">
          <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-16 h-12 rounded border border-border cursor-pointer"
                style={{ backgroundColor: displayHex, padding: "2px" }}
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
                    style={{ padding: "2px" }}
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
                      onChange={(e) =>
                        handleHSLChange(
                          parseFloat(e.target.value) || 0,
                          undefined,
                          undefined,
                        )
                      }
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
                      onChange={(e) =>
                        handleHSLChange(
                          undefined,
                          parseFloat(e.target.value) || 0,
                          undefined,
                        )
                      }
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
                      onChange={(e) =>
                        handleHSLChange(
                          undefined,
                          undefined,
                          parseFloat(e.target.value) || 0,
                        )
                      }
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
                  <Button type="button" size="sm" onClick={handleApply}>
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div
            className="w-12 h-12 rounded border border-border"
            style={{
              backgroundColor: `hsl(${displayH}, ${displayS}%, ${displayL}%)`,
            }}
          />
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">H</Label>
              <Input
                type="number"
                min="0"
                max="360"
                value={displayH}
                onChange={(e) =>
                  onChange(
                    formatHSL(
                      parseFloat(e.target.value) || 0,
                      displayS,
                      displayL,
                    ),
                  )
                }
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
                onChange={(e) =>
                  onChange(
                    formatHSL(
                      displayH,
                      parseFloat(e.target.value) || 0,
                      displayL,
                    ),
                  )
                }
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
                onChange={(e) =>
                  onChange(
                    formatHSL(
                      displayH,
                      displayS,
                      parseFloat(e.target.value) || 0,
                    ),
                  )
                }
                className="h-8"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Settings</h2>
          <p className="text-muted-foreground">
            Customize your dashboard and manage security settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new Event("trigger-onboarding"))}
          >
            <Rocket className="h-4 w-4 mr-2" />
            Quick Start Tour
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-tour="how-to-use"
            onClick={() => window.dispatchEvent(new Event("trigger-demo-tour"))}
          >
            <Globe className="h-4 w-4 mr-2" />
            How to Use
          </Button>
        </div>
      </div>

      <Tabs defaultValue="customization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="customization">Customization</TabsTrigger>
          <TabsTrigger value="security">Security Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="customization" className="space-y-4">

          <div className="flex items-center justify-end mb-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <div>
                      <CardTitle>Organization Code</CardTitle>
                      <CardDescription>
                        Your unique organization identifier (used in API keys)
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => setOrgCodeConfirmDialogOpen(true)}
                    disabled={!organizationCodeChanged || organizationCode.length !== 6}
                  >
                    Save Organization Code
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organization-code">Organization Code *</Label>
                  <Input
                    id="organization-code"
                    type="text"
                    value={organizationCode}
                    onChange={(e) => handleOrganizationCodeChange(e.target.value)}
                    placeholder="abcdef"
                    maxLength={6}
                    className="font-mono"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be exactly 6 lowercase letters or numbers. This code
                    is used in your API keys.
                  </p>
                </div>
                {organizationCodeChanged && (
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Changing the organization code will invalidate all existing API keys.
                  </p>
                )}
              </CardContent>
            </Card>

          {/* Organization Code Change Confirmation Dialog */}
          <AlertDialog open={orgCodeConfirmDialogOpen} onOpenChange={setOrgCodeConfirmDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Change Organization Code?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">
                    This is a destructive action. Changing the organization code will <strong>invalidate all existing API keys</strong> across all resources.
                  </span>
                  <span className="block">
                    All users will need to be issued new keys after this change. This action cannot be undone.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setOrgCodeConfirmDialogOpen(false);
                    handleSaveOrganizationCode();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Change Organization Code
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Theme */}
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Choose your preferred theme mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between light, dark, or system
                  </p>
                </div>
                <Select
                  value={theme}
                  onValueChange={(value) =>
                    setTheme(value as "light" | "dark" | "system")
                  }
                >
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
              {theme === "system" && (
                <p className="text-sm text-muted-foreground">
                  Current system theme:{" "}
                  <span className="font-medium">{resolvedTheme}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Border Radius */}
          <Card>
            <CardHeader>
              <CardTitle>Border Radius</CardTitle>
              <CardDescription>
                Adjust the roundness of UI elements
              </CardDescription>
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
                            Adjust the border radius of UI elements like
                            buttons, cards, and inputs. Higher values create
                            more rounded corners. Range: 0-24px.
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
                    onChange={(e) =>
                      updateSetting(
                        "borderRadius",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-20"
                  />
                </div>
                <Slider
                  value={[settings.borderRadius]}
                  onValueChange={(value) =>
                    updateSetting("borderRadius", value[0])
                  }
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
              <div
                className="p-4 border rounded-lg"
                style={{ borderRadius: `${settings.borderRadius}px` }}
              >
                <p className="text-sm">
                  Preview: This is how elements will look with the selected
                  border radius.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Typography and Colors Tabs */}
          <Tabs
            value={activeAppearanceTab}
            onValueChange={(value) =>
              setActiveAppearanceTab(value as "typography" | "colors")
            }
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="colors">Colors</TabsTrigger>
            </TabsList>

            <TabsContent value="typography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Font Family</CardTitle>
                  <CardDescription>
                    Choose the font family for the application
                  </CardDescription>
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
                              Choose the font family that will be used
                              throughout the dashboard. The selected font will
                              be applied to all text elements.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select
                      value={settings.fontFamily}
                      onValueChange={(value) =>
                        updateSetting("fontFamily", value)
                      }
                    >
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
                  <div
                    className="p-4 border rounded-lg"
                    style={{ fontFamily: settings.fontFamily }}
                  >
                    <p className="text-lg font-medium">Sample Text</p>
                    <p className="text-sm text-muted-foreground">
                      This is how the font will appear throughout the
                      application.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="colors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Color Palette</CardTitle>
                  <CardDescription>
                    Customize the color scheme of the application
                  </CardDescription>
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
                                  The primary color is used for buttons, links,
                                  and other interactive elements. This is the
                                  main brand color of your dashboard.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      }
                      value={settings.primary}
                      onChange={(value) => updateSetting("primary", value)}
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
                                The secondary color is used for secondary
                                buttons and background elements.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.secondary}
                    onChange={(value) => updateSetting("secondary", value)}
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
                                The accent color is used for hover states,
                                highlights, and subtle UI accents.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.accent}
                    onChange={(value) => updateSetting("accent", value)}
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
                                The destructive color is used for delete buttons
                                and dangerous actions.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.destructive}
                    onChange={(value) => updateSetting("destructive", value)}
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
                                The muted color is used for disabled states,
                                borders, and subtle backgrounds.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    }
                    value={settings.muted}
                    onChange={(value) => updateSetting("muted", value)}
                  />

                  <div className="pt-4 border-t space-y-2">
                    <Label>Color Preview</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center"
                        style={{
                          backgroundColor: `hsl(${settings.primary})`,
                          color: "white",
                        }}
                      >
                        Primary
                      </div>
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center border"
                        style={{
                          backgroundColor: `hsl(${settings.secondary})`,
                        }}
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
                        style={{
                          backgroundColor: `hsl(${settings.destructive})`,
                          color: "white",
                        }}
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

        <TabsContent value="security" className="space-y-4">
          {/* Master API Key */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  <div>
                    <CardTitle>Master API Key</CardTitle>
                    <CardDescription>
                      Programmatic admin access for CI/CD, scripts, and integrations
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {masterKeyRevealed ? (
                /* Just-generated state: show the full key */
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      ⚠️ Save this key now — it will not be shown again.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={masterKeyVisible ? masterKeyRevealed : masterKeyRevealed.slice(0, 12) + "•".repeat(36)}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setMasterKeyVisible(!masterKeyVisible)}
                    >
                      {masterKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(masterKeyRevealed);
                        setMasterKeyCopied(true);
                        setTimeout(() => setMasterKeyCopied(false), 2000);
                        toast({ title: "Copied", description: "Master key copied to clipboard" });
                      }}
                    >
                      {masterKeyCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => {
                    setMasterKeyRevealed("");
                    setMasterKeyVisible(false);
                  }}>
                    Done
                  </Button>
                </div>
              ) : profileData.master_api_key_prefix ? (
                /* Key exists: show prefix and actions */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Active Key</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {profileData.master_api_key_prefix}••••••••••
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMasterKeyConfirmAction("generate")}
                        disabled={masterKeyGenerating}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Regenerate
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setMasterKeyConfirmAction("revoke")}
                        disabled={masterKeyGenerating}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Revoke
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This key provides full admin access to all /api routes. Use it in CI/CD pipelines or scripts.
                  </p>
                </div>
              ) : (
                /* No key: show generate button */
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No master key configured. Generate one to enable programmatic admin access via API.
                  </p>
                  <Button
                    onClick={() => setMasterKeyConfirmAction("generate")}
                    disabled={masterKeyGenerating}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Generate Master Key
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Master Key Confirmation Dialog */}
          <AlertDialog open={masterKeyConfirmAction !== null} onOpenChange={(open) => !open && setMasterKeyConfirmAction(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {masterKeyConfirmAction === "revoke" ? "Revoke Master Key?" : profileData.master_api_key_prefix ? "Regenerate Master Key?" : "Generate Master Key?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {masterKeyConfirmAction === "revoke"
                    ? "All programmatic admin access via this key will be disabled immediately. Any scripts or integrations using this key will stop working."
                    : profileData.master_api_key_prefix
                      ? "The existing key will stop working immediately. All scripts and integrations will need to be updated with the new key."
                      : "A new master API key will be generated. This key grants full admin access to all management endpoints."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={masterKeyConfirmAction === "revoke" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                  onClick={async () => {
                    const action = masterKeyConfirmAction;
                    setMasterKeyConfirmAction(null);
                    setMasterKeyGenerating(true);
                    try {
                      if (action === "revoke") {
                        await api.delete("/organization/master-key");
                        setProfileData({ ...profileData, master_api_key_prefix: "" });
                        toast({ title: "Revoked", description: "Master API key has been revoked" });
                      } else {
                        const res = await api.post("/organization/master-key/generate");
                        setMasterKeyRevealed(res.data.master_api_key);
                        setMasterKeyVisible(true);
                        setProfileData({ ...profileData, master_api_key_prefix: res.data.prefix });
                        toast({ title: "Generated", description: "Master API key created — save it now" });
                      }
                    } catch (error: any) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: error.response?.data?.error || `Failed to ${action} master key`,
                      });
                    } finally {
                      setMasterKeyGenerating(false);
                    }
                  }}
                >
                  {masterKeyConfirmAction === "revoke" ? "Revoke Key" : profileData.master_api_key_prefix ? "Regenerate Key" : "Generate Key"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Two-Factor Authentication</CardTitle>
              </div>
              <CardDescription>
                Add an extra layer of security to your admin dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {profileData.two_factor_enabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
                {profileData.two_factor_enabled ? (
                  <Button variant="destructive" onClick={() => setDisable2FADialogOpen(true)}>
                    Disable 2FA
                  </Button>
                ) : (
                  <Button onClick={handleGenerate2FA}>Enable 2FA</Button>
                )}
              </div>
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
                    <CardDescription>
                      Set how long your session should last before logging you out
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={handleSaveSessionTimeout} disabled={!sessionTimeoutChanged}>
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
                            After this time of inactivity, you will be automatically logged out. Minimum: 120 seconds (2 minutes).
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
                      if (value >= 120) handleSessionTimeoutChange(value);
                    }}
                    className="w-32"
                  />
                </div>
                <Slider
                  value={[sessionTimeoutValue]}
                  onValueChange={(value) => handleSessionTimeoutChange(Math.max(120, value[0]))}
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
            </CardContent>
          </Card>


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
                  <Input value={twoFactorSetup.manualKey} readOnly className="font-mono" />
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(twoFactorSetup.manualKey);
                    toast({ title: "Copied", description: "Manual entry key copied to clipboard" });
                  }}>Copy</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Use this key if you cannot scan the QR code</p>
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
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTwoFactorSetup({ ...twoFactorSetup, verificationCode: value });
                }}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-widest"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Enter the 6-digit code from your authenticator app</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFactorDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleVerify2FA} disabled={twoFactorSetup.verificationCode.length !== 6}>
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <AlertDialog open={disable2FADialogOpen} onOpenChange={(open) => { setDisable2FADialogOpen(open); if (!open) setDisable2FACode(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current 2FA verification code to confirm. This will reduce the security of your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="disable-2fa-code">Verification Code</Label>
            <Input
              id="disable-2fa-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={disable2FACode}
              onChange={(e) => setDisable2FACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="font-mono text-center text-lg tracking-widest mt-2"
            />
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setDisable2FADialogOpen(false); setDisable2FACode(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisable2FA} disabled={disable2FACode.length !== 6}>Disable 2FA</Button>
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
