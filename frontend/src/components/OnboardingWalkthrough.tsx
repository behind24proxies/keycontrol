import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Folder,
  SlidersHorizontal,
  Key,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Globe,
  Shield,
  Zap,
  ExternalLink,
  CheckCircle2,
  X,
} from "lucide-react";
import api from "@/lib/api";

const ONBOARDING_DONE_KEY = "keycontrol-onboarding-done";

interface OnboardingWalkthroughProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    title: "Welcome to KeyControl",
    subtitle: "Your API gateway management platform",
    icon: <Rocket className="h-6 w-6" />,
    color: "from-violet-500/20 to-blue-500/20",
    iconColor: "text-violet-500",
  },
  {
    title: "Add a Resource",
    subtitle: "Register an external API backend",
    icon: <Folder className="h-6 w-6" />,
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
    route: "/resources",
  },
  {
    title: "Create a Preset",
    subtitle: "Define access rules and controls",
    icon: <SlidersHorizontal className="h-6 w-6" />,
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
    route: "/presets",
  },
  {
    title: "Issue an API Key",
    subtitle: "Generate credentials for consumers",
    icon: <Key className="h-6 w-6" />,
    color: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-500",
    route: "/api-keys",
  },
  {
    title: "You're All Set!",
    subtitle: "Start proxying requests",
    icon: <Globe className="h-6 w-6" />,
    color: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-500",
  },
];

export default function OnboardingWalkthrough({ open, onOpenChange }: OnboardingWalkthroughProps) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [stats, setStats] = useState({ resources: 0, presets: 0, apiKeys: 0 });
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    if (open) {
      setCurrent(0);
      loadStats();
      loadServerUrl();
    }
  }, [open]);

  const loadStats = async () => {
    try {
      const [projects, presets, keys] = await Promise.all([
        api.get("/resources"),
        api.get("/presets"),
        api.get("/api-keys"),
      ]);
      setStats({
        resources: projects.data?.length || 0,
        presets: presets.data?.length || 0,
        apiKeys: keys.data?.api_keys?.length || 0,
      });
    } catch {
      // Silent
    }
  };

  const loadServerUrl = async () => {
    try {
      const res = await api.get("/settings");
      setServerUrl(res.data?.server_url || window.location.origin);
    } catch {
      setServerUrl(window.location.origin);
    }
  };

  const finish = () => {
    localStorage.setItem(ONBOARDING_DONE_KEY, "true");
    onOpenChange(false);
  };

  const goToRoute = (route: string) => {
    finish();
    navigate(route);
  };

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;
  const exampleUrl = serverUrl || "https://your-server.com";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden [&>button]:hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Skip button */}
        <button
          onClick={finish}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-6">
          {/* Step icon */}
          <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br ${step.color} mb-5`}>
            <span className={step.iconColor}>{step.icon}</span>
          </div>

          {/* Step indicator */}
          <p className="text-xs text-muted-foreground font-medium mb-1 uppercase tracking-wider">
            Step {current + 1} of {steps.length}
          </p>

          <h2 className="text-xl font-semibold tracking-tight mb-1">{step.title}</h2>
          <p className="text-sm text-muted-foreground mb-5">{step.subtitle}</p>

          {/* Step-specific content */}
          {current === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                KeyControl helps you manage, secure, and monitor API access through a
                centralized gateway. Let's walk through the setup.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/40 border">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-medium text-center">Access Control</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/40 border">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-[11px] font-medium text-center">Rate Limiting</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/40 border">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  <span className="text-[11px] font-medium text-center">Usage Tracking</span>
                </div>
              </div>
            </div>
          )}

          {current === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                A resource is an external API (like OpenAI, Stripe, or Groq) that KeyControl
                proxies to. You define its base URL and a unique path for routing.
              </p>
              {stats.resources > 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    {stats.resources} resource{stats.resources !== 1 ? "s" : ""} already configured
                  </span>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => goToRoute("/resources")} className="gap-1.5">
                  <Folder className="h-3.5 w-3.5" />
                  Go to Resources <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {current === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Presets bundle access controls: which resources, allowed HTTP methods, rate limits,
                and IP rules. Each API key is bound to one preset.
              </p>
              {stats.presets > 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    {stats.presets} preset{stats.presets !== 1 ? "s" : ""} already configured
                  </span>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => goToRoute("/presets")} className="gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Go to Presets <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {current === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generate API keys for your consumers. Each key inherits its preset's access
                rules and is used in the <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization</code> header.
              </p>
              {stats.apiKeys > 0 ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    {stats.apiKeys} API key{stats.apiKeys !== 1 ? "s" : ""} issued
                  </span>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => goToRoute("/api-keys")} className="gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  Go to API Keys <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {current === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Send requests to your gateway with the API key in the Authorization header:
              </p>
              <div className="rounded-lg overflow-hidden border bg-[hsl(240,5%,10%)] dark:bg-[hsl(240,5%,8%)]">
                <div className="px-3 py-1.5 border-b border-border/30 bg-muted/30">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">bash</span>
                </div>
                <pre className="p-3 text-[11px] font-mono text-green-400 overflow-x-auto leading-relaxed">
                  <code>{`curl ${exampleUrl}/g/<path>/<endpoint> \\
  -H "Authorization: Bearer um-..." \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Hello!"}'`}</code>
                </pre>
              </div>
              {stats.resources > 0 && stats.presets > 0 && stats.apiKeys > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    All set! Your gateway is configured and ready.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="px-8 pb-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={() => setCurrent(current - 1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={finish}>
                Get Started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCurrent(current + 1)}>
                Next
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ONBOARDING_DONE_KEY };
