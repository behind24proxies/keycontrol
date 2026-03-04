import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import { useToast } from "@/components/ui/use-toast";
import api from "@/lib/api";
import { setToken, isLoggedIn } from "@/lib/auth";
import { LogIn, KeyRound, ShieldCheck, ArrowLeft, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const totpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Focus TOTP input when 2FA step appears
  useEffect(() => {
    if (requires2FA && totpInputRef.current) {
      setTimeout(() => totpInputRef.current?.focus(), 100);
    }
  }, [requires2FA]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", { password });

      // Store password_is_initial flag for warning banner
      if (res.data.password_is_initial) {
        sessionStorage.setItem("password_is_initial", "true");
      } else {
        sessionStorage.removeItem("password_is_initial");
      }

      if (res.data.requires_2fa) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      setToken(res.data.token);
      toast({ title: "Success", description: "Logged in successfully" });
      navigate("/");
    } catch (error: any) {
      const msg = error.response?.data?.error || "Invalid password";
      setError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login/verify-2fa", {
        password,
        totp_code: totpCode,
      });

      // Store password_is_initial flag for warning banner
      if (res.data.password_is_initial) {
        sessionStorage.setItem("password_is_initial", "true");
      } else {
        sessionStorage.removeItem("password_is_initial");
      }

      setToken(res.data.token);
      toast({ title: "Success", description: "Logged in successfully" });
      navigate("/");
    } catch (error: any) {
      const msg = error.response?.data?.error || "Invalid verification code";
      setError(msg);
      toast({ variant: "destructive", title: "Verification Failed", description: msg });
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTotpCode("");
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold tracking-tight">KeyControl</CardTitle>
          <CardDescription className="text-sm">
            {requires2FA
              ? "Two-factor authentication required"
              : "API Gateway Management"}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Inline error */}
          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!requires2FA ? (
            /* ── Step 1: Password ── */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="admin-password" className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Password
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Enter your admin password
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !password}>
                <LogIn className="h-4 w-4 mr-2" />
                {loading ? "Authenticating…" : "Sign In"}
              </Button>
              <div className="text-center">
                <Link
                  to="/reset-password"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          ) : (
            /* ── Step 2: 2FA Verification ── */
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="flex items-center justify-center py-2">
                <div className="p-3 rounded-full bg-primary/10">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <Label htmlFor="totp-code" className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Verification Code
                </Label>
                <Input
                  ref={totpInputRef}
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setTotpCode(val);
                    setError("");
                  }}
                  placeholder="000000"
                  required
                  disabled={loading}
                  className="mt-1.5 text-center text-2xl tracking-[0.5em] font-mono"
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || totpCode.length !== 6}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                {loading ? "Verifying…" : "Verify & Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleBack}
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
