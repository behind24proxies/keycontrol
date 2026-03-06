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
import { Save, RotateCcw, HelpCircle, Key, Rocket, Globe } from "lucide-react";

import { ColorPicker } from "@/components/settings/ColorPicker";
import {
  SecuritySection,
  type ProfileData,
} from "@/components/settings/SecuritySection";

// ── Constants ─────────────────────────────────────────────────────────

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

// ── Page component ────────────────────────────────────────────────────

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

  // Organization state
  const [organizationCode, setOrganizationCode] = useState("");
  const [organizationCodeChanged, setOrganizationCodeChanged] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    two_factor_enabled: false,
    session_timeout_seconds: 3600,
    log_ip_addresses: false,
    organization_code: "",
    master_api_key_prefix: "" as string | null,
    debug_mode: false,
    password_is_initial: false,
  });

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
        debug_mode: res.data.debug_mode || false,
        password_is_initial: res.data.password_is_initial || false,
      });
      setOrganizationCode(res.data.organization_code || "");
      setOrganizationCodeChanged(false);
    } catch (error: any) {
      console.error("Failed to load organization profile:", error);
    }
  };

  const handleOrganizationCodeChange = (value: string) => {
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

        {/* ── Customization Tab ──────────────────────────────────────── */}
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

          {/* Organization Code */}
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

          {/* Org Code Confirm Dialog */}
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
              <CardDescription>Choose your preferred theme mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme Mode</Label>
                  <p className="text-sm text-muted-foreground">Choose between light, dark, or system</p>
                </div>
                <Select
                  value={theme}
                  onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
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
                            Adjust the border radius of UI elements like buttons, cards, and inputs. Higher values create more rounded corners. Range: 0-24px.
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
                    onChange={(e) => updateSetting("borderRadius", parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </div>
                <Slider
                  value={[settings.borderRadius]}
                  onValueChange={(value) => updateSetting("borderRadius", value[0])}
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
                  Preview: This is how elements will look with the selected border radius.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Typography / Colors Sub-Tabs */}
          <Tabs
            value={activeAppearanceTab}
            onValueChange={(value) => setActiveAppearanceTab(value as "typography" | "colors")}
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
                              Choose the font family that will be used throughout the dashboard. The selected font will be applied to all text elements.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select
                      value={settings.fontFamily}
                      onValueChange={(value) => updateSetting("fontFamily", value)}
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
                  {[
                    { key: "primary" as const, label: "Primary Color", tooltip: "The primary color is used for buttons, links, and other interactive elements. This is the main brand color of your dashboard." },
                    { key: "secondary" as const, label: "Secondary Color", tooltip: "The secondary color is used for secondary buttons and background elements." },
                    { key: "accent" as const, label: "Accent Color", tooltip: "The accent color is used for hover states, highlights, and subtle UI accents." },
                    { key: "destructive" as const, label: "Destructive Color", tooltip: "The destructive color is used for delete buttons and dangerous actions." },
                    { key: "muted" as const, label: "Muted Color", tooltip: "The muted color is used for disabled states, borders, and subtle backgrounds." },
                  ].map(({ key, label, tooltip }) => (
                    <ColorPicker
                      key={key}
                      label={
                        <div className="flex items-center gap-2">
                          <span>{label}</span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      }
                      value={settings[key]}
                      onChange={(value) => updateSetting(key, value)}
                    />
                  ))}

                  <div className="pt-4 border-t space-y-2">
                    <Label>Color Preview</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div
                        className="h-16 rounded p-2 text-sm font-medium flex items-center justify-center"
                        style={{ backgroundColor: `hsl(${settings.primary})`, color: "white" }}
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
                        style={{ backgroundColor: `hsl(${settings.destructive})`, color: "white" }}
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

        {/* ── Security Tab ───────────────────────────────────────────── */}
        <TabsContent value="security" className="space-y-4">
          <SecuritySection
            profileData={profileData}
            setProfileData={setProfileData}
            loadOrgProfile={loadOrgProfile}
          />
        </TabsContent>
      </Tabs>

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
