import { useState } from "react";
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
import { Slider } from "@/components/ui/slider";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import {
  Shield,
  Clock,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Lock,
  Bug,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ── Types ─────────────────────────────────────────────────────────────

export interface ProfileData {
  two_factor_enabled: boolean;
  session_timeout_seconds: number;
  log_ip_addresses: boolean;
  organization_code: string;
  master_api_key_prefix: string | null;
  debug_mode: boolean;
  password_is_initial: boolean;
}

interface SecuritySectionProps {
  profileData: ProfileData;
  setProfileData: React.Dispatch<React.SetStateAction<ProfileData>>;
  loadOrgProfile: () => Promise<void>;
}

// ── Helper ────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins !== 1 ? "s" : ""}`;
  }
  const hours = Math.floor(seconds / 3600);
  const remainingMinutes = Math.floor((seconds % 3600) / 60);
  if (remainingMinutes === 0) return `${hours} hour${hours !== 1 ? "s" : ""}`;
  return `${hours}h ${remainingMinutes}m`;
}

// ── Component ─────────────────────────────────────────────────────────

export function SecuritySection({
  profileData,
  setProfileData,
  loadOrgProfile,
}: SecuritySectionProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Session timeout
  const [sessionTimeoutValue, setSessionTimeoutValue] = useState(
    profileData.session_timeout_seconds,
  );
  const [sessionTimeoutChanged, setSessionTimeoutChanged] = useState(false);

  // 2FA
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

  // Master key
  const [masterKeyRevealed, setMasterKeyRevealed] = useState("");
  const [masterKeyVisible, setMasterKeyVisible] = useState(false);
  const [masterKeyGenerating, setMasterKeyGenerating] = useState(false);
  const [masterKeyCopied, setMasterKeyCopied] = useState(false);
  const [masterKeyConfirmAction, setMasterKeyConfirmAction] = useState<
    "generate" | "revoke" | null
  >(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────

  const handleSessionTimeoutChange = (seconds: number) => {
    if (seconds < 120) return;
    setSessionTimeoutValue(seconds);
    setSessionTimeoutChanged(seconds !== profileData.session_timeout_seconds);
  };

  const handleSaveSessionTimeout = async () => {
    if (sessionTimeoutValue < 120) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Session timeout must be at least 120 seconds",
      });
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await api.put("/organization/session-timeout", {
        session_timeout_seconds: sessionTimeoutValue,
      });
      setProfileData({ ...profileData, session_timeout_seconds: sessionTimeoutValue });
      setSessionTimeoutChanged(false);
      toast({ title: "Success", description: "Session timeout updated successfully" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to update session timeout",
      });
    } finally {
      setSaving(false);
    }
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

  return (
    <>
      {/* Password Change Warning Banner */}
      {profileData.password_is_initial && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Password change recommended
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              Your password was set from the server environment and has never been changed.
              It is strongly recommended to change it now for security.
            </p>
          </div>
        </div>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <div>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your admin dashboard login password
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="current-password" className="text-sm">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={passwordChanging}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="text-sm">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={passwordChanging}
                className="mt-1"
              />
              {newPassword && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  <li className={newPassword.length >= 8 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                    {newPassword.length >= 8 ? "✓" : "✗"} At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                    {/[A-Z]/.test(newPassword) ? "✓" : "✗"} One uppercase letter
                  </li>
                  <li className={/[a-z]/.test(newPassword) ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                    {/[a-z]/.test(newPassword) ? "✓" : "✗"} One lowercase letter
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                    {/[0-9]/.test(newPassword) ? "✓" : "✗"} One number
                  </li>
                </ul>
              )}
            </div>
            <div>
              <Label htmlFor="confirm-new-password" className="text-sm">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={passwordChanging}
                className="mt-1"
              />
              {confirmNewPassword && newPassword !== confirmNewPassword && (
                <p className="text-xs text-destructive mt-1">Passwords do not match</p>
              )}
            </div>
          </div>
          <Button
            onClick={async () => {
              const meetsComplexity = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword);
              if (!currentPassword || !meetsComplexity || newPassword !== confirmNewPassword) {
                toast({ variant: "destructive", title: "Error", description: "Please fill all fields correctly. Password must be at least 8 characters with uppercase, lowercase, and a number." });
                return;
              }
              setPasswordChanging(true);
              try {
                await api.put("/organization/password", {
                  current_password: currentPassword,
                  new_password: newPassword,
                });
                toast({ title: "Success", description: "Password changed successfully" });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                setProfileData({ ...profileData, password_is_initial: false });
                sessionStorage.removeItem("password_is_initial");
              } catch (error: any) {
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: error.response?.data?.error || "Failed to change password",
                });
              } finally {
                setPasswordChanging(false);
              }
            }}
            disabled={
              passwordChanging ||
              !currentPassword ||
              newPassword.length < 8 ||
              !/[A-Z]/.test(newPassword) ||
              !/[a-z]/.test(newPassword) ||
              !/[0-9]/.test(newPassword) ||
              newPassword !== confirmNewPassword
            }
          >
            <Lock className="h-4 w-4 mr-2" />
            {passwordChanging ? "Changing…" : "Change Password"}
          </Button>
        </CardContent>
      </Card>

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
                <Button variant="outline" size="icon" onClick={() => setMasterKeyVisible(!masterKeyVisible)}>
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
              <Button variant="outline" size="sm" onClick={() => { setMasterKeyRevealed(""); setMasterKeyVisible(false); }}>
                Done
              </Button>
            </div>
          ) : profileData.master_api_key_prefix ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active Key</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {profileData.master_api_key_prefix}••••••••••
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMasterKeyConfirmAction("generate")} disabled={masterKeyGenerating}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Regenerate
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setMasterKeyConfirmAction("revoke")} disabled={masterKeyGenerating}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Revoke
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This key provides full admin access to all /api routes. Use it in CI/CD pipelines or scripts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No master key configured. Generate one to enable programmatic admin access via API.
              </p>
              <Button onClick={() => setMasterKeyConfirmAction("generate")} disabled={masterKeyGenerating}>
                <Key className="h-4 w-4 mr-2" /> Generate Master Key
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

      {/* Gateway Debug Mode */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            <div>
              <CardTitle>Gateway Debug Mode</CardTitle>
              <CardDescription>
                Get detailed diagnostics when gateway requests are rejected
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Status</p>
              <p className="text-sm text-muted-foreground">
                {profileData.debug_mode ? "Enabled" : "Disabled"}
              </p>
            </div>
            <Button
              variant={profileData.debug_mode ? "destructive" : "default"}
              onClick={async () => {
                const newValue = !profileData.debug_mode;
                try {
                  await api.put("/organization/debug-mode", { debug_mode: newValue });
                  setProfileData({ ...profileData, debug_mode: newValue });
                  toast({
                    title: "Success",
                    description: `Debug mode ${newValue ? "enabled" : "disabled"}`,
                  });
                } catch (error: any) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.response?.data?.error || "Failed to toggle debug mode",
                  });
                }
              }}
            >
              {profileData.debug_mode ? "Disable Debug Mode" : "Enable Debug Mode"}
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              When enabled, gateway error responses (403 / 405) will include detailed information about why the request was rejected:
            </p>
            <ul className="list-disc list-inside text-xs space-y-0.5 ml-2">
              <li><strong>Method not allowed</strong> — shows which methods ARE allowed by the preset</li>
              <li><strong>Endpoint not allowed</strong> — lists all allowed endpoint patterns and groups</li>
              <li><strong>Resource not allowed</strong> — shows which resource was requested</li>
            </ul>
          </div>
          {profileData.debug_mode && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                ⚠️ Debug mode reveals internal routing patterns. Disable before deploying to production.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}
