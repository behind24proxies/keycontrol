import { useState } from "react";
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
import { KeyRound, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [resetHash, setResetHash] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordsMatch = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;
  const canSubmit =
    resetHash.length > 0 &&
    passwordLongEnough &&
    passwordsMatch &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/reset-password", {
        reset_hash: resetHash,
        new_password: newPassword,
      });

      toast({
        title: "Password Reset",
        description: "You can now log in with your new password.",
      });
      navigate("/login");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to reset password";
      setError(msg);
      toast({ variant: "destructive", title: "Reset Failed", description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold tracking-tight">Reset Password</CardTitle>
          <CardDescription className="text-sm">
            Enter the reset hash from your server environment
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reset Hash */}
            <div>
              <Label htmlFor="reset-hash" className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                Reset Hash
              </Label>
              <Input
                id="reset-hash"
                type="password"
                value={resetHash}
                onChange={(e) => { setResetHash(e.target.value); setError(""); }}
                placeholder="Paste the RESET_HASH from your .env"
                disabled={loading}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Set <code className="px-1 py-0.5 bg-muted rounded text-[11px]">RESET_HASH</code> in
                your server's <code className="px-1 py-0.5 bg-muted rounded text-[11px]">.env</code> file
                and restart. Each hash is single-use.
              </p>
            </div>

            {/* New Password */}
            <div>
              <Label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                placeholder="Enter new password"
                disabled={loading}
                className="mt-1.5"
              />
              {newPassword && !passwordLongEnough && (
                <p className="text-xs text-destructive mt-1.5">Must be at least 8 characters</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Confirm new password"
                disabled={loading}
                className="mt-1.5"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive mt-1.5">Passwords don't match</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? "Resetting…" : "Reset Password"}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
