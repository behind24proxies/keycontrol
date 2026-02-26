import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  type Placement,
} from "@floating-ui/react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  X,
  Rocket,
  Globe,
  Folder,
  SlidersHorizontal,
  Key,
  CheckCircle2,
  Zap,
  Copy,
  Check,
  Shield,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────
type Phase =
  | "intro"
  | "goto-resources"
  | "click-new-resource"
  | "guide-resource-fields"
  | "resource-created"
  | "click-resource-manage"
  | "click-new-group"
  | "guide-group-fields"
  | "group-created"
  | "click-add-endpoint"
  | "guide-endpoint-fields"
  | "endpoint-created"
  | "click-presets-nav"
  | "click-new-preset"
  | "guide-preset-fields"
  | "preset-created"
  | "click-apikeys-nav"
  | "click-new-apikey"
  | "guide-apikey-fields"
  | "apikey-created"
  | "click-presets-nav-final"
  | "show-preset"
  | "open-access-modal"
  | "highlight-url"
  | "final";

interface FieldGuide {
  selector: string;
  title: string;
  content: string;
  placement?: Placement;
}

interface TrackedData {
  initialResourceCount: number;
  newResourceId: number | null;
  newResourceName: string;
  newResourcePath: string;
  newResourceExternalUrl: string;
  initialGroupCount: number;
  initialEndpointCount: number;
  initialPresetCount: number;
  newPresetName: string;
  initialApiKeyCount: number;
}

// Phases where a dialog is open — NO spotlight overlay, tooltip only
const DIALOG_PHASES: Phase[] = [
  "guide-resource-fields",
  "guide-group-fields",
  "guide-endpoint-fields",
  "guide-preset-fields",
  "guide-apikey-fields",
  "highlight-url",
];

// ── Field guides per form ─────────────────────────────────────────────
const RESOURCE_FIELDS: FieldGuide[] = [
  {
    selector: '[role="dialog"] #name',
    title: "Resource Name",
    content:
      'Give your resource a descriptive name — e.g. "OpenAI", "Stripe API", or "Internal Auth Service".',
    placement: "right",
  },
  {
    selector: '[role="dialog"] #description',
    title: "Description (optional)",
    content:
      "A brief note about what this API is used for. Helps your team understand the purpose.",
    placement: "right",
  },
  {
    selector: '[role="dialog"] #unique_path',
    title: "Unique Path",
    content:
      'This becomes part of your gateway URL. For example, entering "openai" means requests go to your-server.com/openai. Use lowercase, no spaces.',
    placement: "right",
  },
  {
    selector: '[role="dialog"] #secret_api_key',
    title: "Secret API Key",
    content:
      "Your real API key for this service. KeyControl stores it securely and uses it to forward requests — your consumers never see it.",
    placement: "right",
  },
  {
    selector: '[role="dialog"] #external_api_base_url',
    title: "External API Base URL",
    content:
      'The root URL of the external API. For example: "https://api.openai.com". Requests are forwarded here.',
    placement: "right",
  },
];

const GROUP_FIELDS: FieldGuide[] = [
  {
    selector: '[role="dialog"] input[required]',
    title: "Group Name",
    content:
      'Name this endpoint group — e.g. "Chat Endpoints", "Billing API", or "Admin Routes". Groups organize related endpoints.',
    placement: "right",
  },
];

const ENDPOINT_FIELDS: FieldGuide[] = [
  {
    selector: '[role="dialog"] input[placeholder]',
    title: "URL Pattern",
    content:
      'Enter the endpoint path — e.g. "/v1/chat/completions" or "/v1/models". Use * as a wildcard for dynamic segments.',
    placement: "right",
  },
];

const PRESET_FIELDS: FieldGuide[] = [
  {
    selector: '[role="dialog"] #preset-name',
    title: "Preset Name",
    content:
      'Name this preset — e.g. "Developer Access", "Production Read-Only". Presets bundle access rules for API keys.',
    placement: "right",
  },
];

const APIKEY_FIELDS: FieldGuide[] = [
  {
    selector: '[role="dialog"] #uc-name',
    title: "API Key Name",
    content:
      'Name this key — e.g. "Mobile App", "CI/CD Pipeline". Helps you identify who or what is using this key.',
    placement: "right",
  },
  {
    selector: '[role="dialog"] #uc-preset',
    title: "Select Preset",
    content:
      "Choose the preset you just created. This determines which resources and endpoints this key can access.",
    placement: "right",
  },
];



// ── Main component ────────────────────────────────────────────────────
interface InteractiveDemoTourProps {
  active: boolean;
  onFinish: () => void;
}

export default function InteractiveDemoTour({
  active,
  onFinish,
}: InteractiveDemoTourProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [fieldIndex, setFieldIndex] = useState(0);
  const [tracked, setTracked] = useState<TrackedData>({
    initialResourceCount: 0,
    newResourceId: null,
    newResourceName: "",
    newResourcePath: "",
    newResourceExternalUrl: "",
    initialGroupCount: 0,
    initialEndpointCount: 0,
    initialPresetCount: 0,
    newPresetName: "",
    initialApiKeyCount: 0,
  });
  const [urlCopied, setUrlCopied] = useState(false);
  const arrowRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<(() => void) | null>(null);
  const trackedRef = useRef(tracked);
  trackedRef.current = tracked;

  // Is this a dialog-level phase?
  const isDialogPhase = DIALOG_PHASES.includes(phase);

  // Current placement for floating tooltip
  const currentPlacement = useCallback((): Placement => {
    if (phase === "guide-resource-fields") return RESOURCE_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-group-fields") return GROUP_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-endpoint-fields") return ENDPOINT_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-preset-fields") return PRESET_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-apikey-fields") return APIKEY_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "show-preset" || phase === "open-access-modal") return "bottom";
    return "bottom";
  }, [phase, fieldIndex]);

  const { refs, floatingStyles, middlewareData } = useFloating({
    placement: currentPlacement(),
    middleware: [
      offset(14),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // ── Cleanup polling ───────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      pollRef.current();
      pollRef.current = null;
    }
  }, []);

  /** Start a requestAnimationFrame loop. Returns cleanup function stored in pollRef. */
  const startRafPoll = useCallback((checkFn: () => boolean | void) => {
    let active = true;
    const loop = () => {
      if (!active) return;
      const shouldStop = checkFn();
      if (!shouldStop && active) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    pollRef.current = () => { active = false; };
  }, []);

  // ── Highlight helpers ─────────────────────────────────────────────
  const highlightedRef = useRef<HTMLElement | null>(null);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove("tour-highlight", "tour-highlight-field");
      highlightedRef.current = null;
    }
    refs.setReference(null);
  }, [refs]);

  /** Find element using rAF (near-instant), apply highlight CSS class, set as floating-ui reference */
  const highlightElement = useCallback(
    (selector: string, isField = false): Promise<HTMLElement | null> => {
      return new Promise((resolve) => {
        let active = true;
        const tryFind = () => {
          if (!active) return;
          const el = document.querySelector(selector) as HTMLElement | null;
          if (el) {
            clearHighlight();
            el.classList.add(isField ? "tour-highlight-field" : "tour-highlight");
            highlightedRef.current = el;
            refs.setReference(el);
            resolve(el);
          } else {
            requestAnimationFrame(tryFind);
          }
        };
        requestAnimationFrame(tryFind);
        // Safety timeout: give up after 10 seconds
        setTimeout(() => { active = false; resolve(null); }, 10000);
      });
    },
    [refs, clearHighlight]
  );

  // ── Finish tour ───────────────────────────────────────────────────
  const finish = useCallback(() => {
    stopPolling();
    clearHighlight();
    setPhase("intro");
    setFieldIndex(0);
    const closeBtn = document.querySelector(
      "[role='dialog'] button[class*='absolute']"
    );
    if (closeBtn) (closeBtn as HTMLElement).click();
    onFinish();
  }, [stopPolling, clearHighlight, onFinish]);

  // ── Reset on activate ─────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      setPhase("intro");
      setFieldIndex(0);
      clearHighlight();
      setUrlCopied(false);
      setTracked({
        initialResourceCount: 0,
        newResourceId: null,
        newResourceName: "",
        newResourcePath: "",
        newResourceExternalUrl: "",
        initialGroupCount: 0,
        initialEndpointCount: 0,
        initialPresetCount: 0,
        newPresetName: "",
        initialApiKeyCount: 0,
      });
    }
    return () => { stopPolling(); clearHighlight(); };
  }, [active, stopPolling, clearHighlight]);

  // ── Phase transitions ─────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    stopPolling();
    clearHighlight(); // Immediately remove old highlight/tooltip on phase change

    const run = async () => {
      switch (phase) {
        // ── Navigate to resources ───────────────────────────
        case "goto-resources": {
          try {
            const res = await api.get("/resources");
            setTracked((t) => ({
              ...t,
              initialResourceCount: res.data?.length || 0,
            }));
          } catch { /* ignore */ }
          navigate("/resources");
          setTimeout(() => setPhase("click-new-resource"), 300);
          break;
        }

        // ── Spotlight "New Resource" — user clicks it ────────
        case "click-new-resource": {
          await highlightElement('[data-tour-create="resource"]');
          // rAF poll: instant dialog detection
          startRafPoll(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              stopPolling();
              setFieldIndex(0);
              setPhase("guide-resource-fields");
              return true;
            }
          });
          break;
        }

        // ── Guide resource form fields (NO overlay) ─────────
        case "guide-resource-fields": {
          const fields = RESOURCE_FIELDS;
          const selector = fieldIndex < fields.length
            ? fields[fieldIndex].selector
            : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // Poll for dialog close -> resource created (API check throttled)
          {
            let lastApiCall = 0;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog) {
                const now = Date.now();
                if (now - lastApiCall < 400) return; // throttle API calls
                lastApiCall = now;
                api.get("/resources").then((res) => {
                  const projects = res.data || [];
                  if (projects.length > trackedRef.current.initialResourceCount) {
                    const newest = projects.reduce((a: any, b: any) => (a.id > b.id ? a : b));
                    setTracked((t) => ({
                      ...t,
                      newResourceId: newest.id,
                      newResourceName: newest.name,
                      newResourcePath: newest.unique_path || "",
                      newResourceExternalUrl:
                        newest.external_api_base_url || newest.external_api_url || "",
                    }));
                    stopPolling();
                    setPhase("resource-created");
                  }
                }).catch(() => {});
              }
            });
          }
          break;
        }

        // ── Resource created — wait for user to continue ─────
        case "resource-created": {
          clearHighlight();
          // User clicks "Continue →" in the success modal to advance
          break;
        }

        // ── Spotlight the new resource's Manage button ────────
        case "click-resource-manage": {
          if (trackedRef.current.newResourceId) {
            await highlightElement(
              `[data-tour-resource="${trackedRef.current.newResourceId}"]`
            );
            // rAF poll: instant URL change detection
            startRafPoll(() => {
              if (window.location.pathname.includes(`/resources/${trackedRef.current.newResourceId}`)) {
                stopPolling();
                setPhase("click-new-group");
                return true;
              }
            });
          }
          break;
        }

        // ── Spotlight "New Group" — user clicks it ───────────
        case "click-new-group": {
          // Fetch group count in background (needed later to detect new group)
          if (trackedRef.current.newResourceId) {
            api.get(`/resources/${trackedRef.current.newResourceId}`).then((res) => {
              setTracked((t) => ({
                ...t,
                initialGroupCount: res.data?.endpoint_groups?.length || 0,
              }));
            }).catch(() => {});
          }
          await highlightElement('[data-tour-create="group"]');
          // rAF poll: instant dialog detection
          startRafPoll(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              stopPolling();
              setFieldIndex(0);
              setPhase("guide-group-fields");
              return true;
            }
          });
          break;
        }

        // ── Guide group fields (NO overlay) ─────────────────
        case "guide-group-fields": {
          const fields = GROUP_FIELDS;
          const selector = fieldIndex < fields.length
            ? fields[fieldIndex].selector
            : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // Poll for dialog close -> group created (API check throttled)
          {
            let lastApiCall = 0;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && trackedRef.current.newResourceId) {
                const now = Date.now();
                if (now - lastApiCall < 400) return;
                lastApiCall = now;
                api.get(`/resources/${trackedRef.current.newResourceId}`).then((res) => {
                  const groups = res.data?.endpoint_groups || [];
                  if (groups.length > trackedRef.current.initialGroupCount) {
                    setTracked((t) => ({ ...t, initialEndpointCount: 0 }));
                    stopPolling();
                    setPhase("group-created");
                  }
                }).catch(() => {});
              }
            });
          }
          break;
        }

        // ── Group created — wait for user to continue ────────
        case "group-created": {
          clearHighlight();
          // User clicks "Continue →" in the success modal to advance
          break;
        }

        // ── Spotlight "Add Endpoint" — user clicks it ────────
        case "click-add-endpoint": {
          await highlightElement('[data-tour-create="endpoint"]');
          startRafPoll(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              stopPolling();
              setFieldIndex(0);
              setPhase("guide-endpoint-fields");
              return true;
            }
          });
          break;
        }

        // ── Guide endpoint fields (NO overlay) ──────────────
        case "guide-endpoint-fields": {
          const fields = ENDPOINT_FIELDS;
          const selector = fieldIndex < fields.length
            ? fields[fieldIndex].selector
            : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          {
            let lastApiCall = 0;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && trackedRef.current.newResourceId) {
                const now = Date.now();
                if (now - lastApiCall < 400) return;
                lastApiCall = now;
                api.get(`/resources/${trackedRef.current.newResourceId}`).then((res) => {
                  const groups = res.data?.endpoint_groups || [];
                  const hasEndpoints = groups.some(
                    (g: any) => g.endpoints && g.endpoints.length > 0
                  );
                  if (hasEndpoints) {
                    stopPolling();
                    setPhase("endpoint-created");
                  }
                }).catch(() => {});
              }
            });
          }
          break;
        }

        // ── Endpoint created — wait for user to continue ─────
        case "endpoint-created": {
          clearHighlight();
          // User clicks "Continue →" in the success modal to advance
          break;
        }

        // ── Spotlight Presets in sidebar — user clicks it ─────
        case "click-presets-nav": {
          await highlightElement('[data-tour="presets"]');
          startRafPoll(() => {
            if (window.location.pathname === "/presets") {
              stopPolling();
              setPhase("click-new-preset");
              return true;
            }
          });
          break;
        }

        // ── Spotlight "New Preset" — user clicks it ──────────
        case "click-new-preset": {
          // Fetch preset count in background
          api.get("/presets").then((res) => {
            setTracked((t) => ({
              ...t,
              initialPresetCount: res.data?.length || 0,
            }));
          }).catch(() => {});
          await highlightElement('[data-tour-create="preset"]');
          startRafPoll(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              stopPolling();
              setFieldIndex(0);
              setPhase("guide-preset-fields");
              return true;
            }
          });
          break;
        }

        // ── Guide preset fields (NO overlay) ────────────────
        case "guide-preset-fields": {
          const fields = PRESET_FIELDS;
          const selector = fieldIndex < fields.length
            ? fields[fieldIndex].selector
            : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          {
            let lastApiCall = 0;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog) {
                const now = Date.now();
                if (now - lastApiCall < 400) return;
                lastApiCall = now;
                api.get("/presets").then((res) => {
                  const presets = res.data || [];
                  if (presets.length > trackedRef.current.initialPresetCount) {
                    const newest = presets[presets.length - 1];
                    setTracked((t) => ({ ...t, newPresetName: newest.name }));
                    stopPolling();
                    setPhase("preset-created");
                  }
                }).catch(() => {});
              }
            });
          }
          break;
        }

        // ── Preset created — wait for user to continue ────────
        case "preset-created": {
          clearHighlight();
          // User clicks "Continue →" in the success modal to advance
          break;
        }

        // ── Spotlight API Keys in sidebar — user clicks it ────
        case "click-apikeys-nav": {
          await highlightElement('[data-tour="api-keys"]');
          startRafPoll(() => {
            if (window.location.pathname === "/api-keys") {
              stopPolling();
              setPhase("click-new-apikey");
              return true;
            }
          });
          break;
        }

        // ── Spotlight "New API Key" — user clicks it ─────────
        case "click-new-apikey": {
          // Fetch key count in background
          api.get("/api-keys").then((res) => {
            setTracked((t) => ({
              ...t,
              initialApiKeyCount: res.data?.api_keys?.length || 0,
            }));
          }).catch(() => {});
          await highlightElement('[data-tour-create="apikey"]');
          startRafPoll(() => {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              stopPolling();
              setFieldIndex(0);
              setPhase("guide-apikey-fields");
              return true;
            }
          });
          break;
        }

        // ── Guide API key fields (NO overlay) ────────────────
        case "guide-apikey-fields": {
          const fields = APIKEY_FIELDS;
          const selector = fieldIndex < fields.length
            ? fields[fieldIndex].selector
            : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          {
            let lastApiCall = 0;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog) {
                const now = Date.now();
                if (now - lastApiCall < 400) return;
                lastApiCall = now;
                api.get("/api-keys").then((res) => {
                  const keys = res.data?.api_keys || [];
                  if (keys.length > trackedRef.current.initialApiKeyCount) {
                    stopPolling();
                    setPhase("apikey-created");
                  }
                }).catch(() => {});
              }
            });
          }
          break;
        }

        // ── API key created — wait for user to continue ──────
        case "apikey-created": {
          clearHighlight();
          // User clicks "Continue →" in the success modal to advance
          break;
        }

        // ── Spotlight Presets in sidebar (final) — user clicks ─
        case "click-presets-nav-final": {
          await highlightElement('[data-tour="presets"]');
          startRafPoll(() => {
            if (window.location.pathname === "/presets") {
              stopPolling();
              setPhase("show-preset");
              return true;
            }
          });
          break;
        }

        // ── Spotlight the preset card ────────────────────────
        case "show-preset": {
          if (trackedRef.current.newPresetName) {
            await highlightElement(
              `[data-preset-name="${trackedRef.current.newPresetName}"]`
            );
          }
          break;
        }

        // ── Open access modal ────────────────────────────────
        case "open-access-modal": {
          if (trackedRef.current.newPresetName) {
            // Spotlight the access button and let user click
            await highlightElement(
              `[data-access-btn="${trackedRef.current.newPresetName}"]`
            );
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (dialog) {
                stopPolling();
                setPhase("highlight-url");
                return true;
              }
            });
          }
          break;
        }

        // ── Highlight copy URL button (inside modal, NO overlay) ─
        case "highlight-url": {
          const btns = document.querySelectorAll("[data-copy-url-btn]");
          btns.forEach((btn) => {
            (btn as HTMLElement).style.opacity = "1";
          });
          await highlightElement("[data-copy-url-btn]", true);
          break;
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase, fieldIndex]);

  // ── Handle field advancement ──────────────────────────────────────
  const advanceField = useCallback(() => {
    const getMaxFields = () => {
      if (phase === "guide-resource-fields") return RESOURCE_FIELDS.length;
      if (phase === "guide-group-fields") return GROUP_FIELDS.length;
      if (phase === "guide-endpoint-fields") return ENDPOINT_FIELDS.length;
      if (phase === "guide-preset-fields") return PRESET_FIELDS.length;
      if (phase === "guide-apikey-fields") return APIKEY_FIELDS.length;
      return 0;
    };
    const max = getMaxFields();
    if (fieldIndex < max) {
      setFieldIndex((i) => i + 1);
    }
  }, [phase, fieldIndex]);


  if (!active) return null;

  // ── Phase: Intro ──────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/50" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="bg-popover border rounded-xl max-w-lg w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

            <div className="px-7 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/20">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Let's Set Up Your Gateway
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    A hands-on walkthrough — takes about 3 minutes
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                We'll guide you through creating everything you need to start
                proxying API requests. You'll build each piece yourself, so
                you'll know exactly how it all works.
              </p>

              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {[
                  { icon: Folder, label: "Register a Resource", color: "text-blue-500" },
                  { icon: Zap, label: "Add Endpoints", color: "text-amber-500" },
                  { icon: SlidersHorizontal, label: "Create a Preset", color: "text-violet-500" },
                  { icon: Key, label: "Issue an API Key", color: "text-emerald-500" },
                ].map(({ icon: Icon, label, color }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border"
                  >
                    <Icon className={`h-4 w-4 ${color} shrink-0`} />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-7 pb-5 flex items-center justify-between">
              <button
                onClick={finish}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
              <Button
                size="sm"
                className="px-5"
                onClick={() => setPhase("goto-resources")}
              >
                Let's Begin
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Phase: Success confirmations ──────────────────────────────────
  if (
    phase === "resource-created" ||
    phase === "group-created" ||
    phase === "endpoint-created" ||
    phase === "preset-created" ||
    phase === "apikey-created"
  ) {
    const resName = tracked.newResourceName || "your resource";
    const presetName = tracked.newPresetName || "your preset";
    const messages: Record<string, { title: string; next: string; nextPhase: Phase }> = {
      "resource-created": {
        title: `"${resName}" Created!`,
        next: `Click "Manage" on "${resName}" to set up endpoint groups.`,
        nextPhase: "click-resource-manage",
      },
      "group-created": {
        title: "Endpoint Group Created!",
        next: "Now let's add an endpoint to it.",
        nextPhase: "click-add-endpoint",
      },
      "endpoint-created": {
        title: "Endpoint Added!",
        next: "Navigate to Presets to create an access preset.",
        nextPhase: "click-presets-nav",
      },
      "preset-created": {
        title: `"${presetName}" Created!`,
        next: "Navigate to API Keys to issue a key.",
        nextPhase: "click-apikeys-nav",
      },
      "apikey-created": {
        title: "API Key Issued!",
        next: "Navigate back to Presets to see how it all comes together.",
        nextPhase: "click-presets-nav-final",
      },
    };
    const msg = messages[phase];

    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/50" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="bg-popover border rounded-xl px-7 py-5 max-w-sm text-center shadow-xl animate-in fade-in-0 zoom-in-95 duration-300">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1">{msg.title}</h3>
            <p className="text-xs text-muted-foreground mb-4">{msg.next}</p>
            <Button
              size="sm"
              className="px-5"
              onClick={() => setPhase(msg.nextPhase)}
            >
              Continue
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ── Phase: Final explainer ────────────────────────────────────────
  if (phase === "final") {
    const serverBase = `${window.location.protocol}//${window.location.hostname}:3001`;
    const resourcePath = tracked.newResourcePath || "<path>";
    const externalUrl = tracked.newResourceExternalUrl || "https://api.example.com";

    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/50" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="bg-popover border rounded-xl max-w-xl w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-green-500/60 via-emerald-500 to-green-500/60" />

            <div className="px-7 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                  <Globe className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Your Gateway is Ready
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Here's how requests flow through KeyControl
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Send requests{" "}
                  <strong className="text-foreground">
                    in the exact same format
                  </strong>{" "}
                  as you normally would to{" "}
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                    {externalUrl}
                  </code>{" "}
                  — same headers, same body, same method — but to the{" "}
                  <strong className="text-foreground">
                    KeyControl gateway URL
                  </strong>{" "}
                  instead.
                </p>

                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs font-semibold text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded mt-0.5 shrink-0">
                      BEFORE
                    </span>
                    <code className="text-[11px] font-mono text-muted-foreground break-all">
                      {externalUrl}/&lt;endpoint-path&gt;
                    </code>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded mt-0.5 shrink-0">
                      AFTER
                    </span>
                    <code className="text-[11px] font-mono text-primary break-all">
                      {serverBase}/{resourcePath}?url={externalUrl}/&lt;endpoint-path&gt;
                    </code>
                  </div>
                </div>

                <p>
                  Include your API key in the{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    Authorization: Bearer uc-...
                  </code>{" "}
                  header. KeyControl validates access permissions, enforces rate
                  limits and IP restrictions, then forwards the request to the
                  upstream API using the real credentials you stored — your
                  consumers never see the original key.
                </p>

                <div className="rounded-lg overflow-hidden border bg-[hsl(240,5%,10%)] dark:bg-[hsl(240,5%,8%)]">
                  <div className="px-3 py-1.5 border-b border-border/30 bg-muted/30 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Example request
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const cmd = `curl "${serverBase}/${resourcePath}?url=${externalUrl}/<endpoint-path>" \\\n  -H "Authorization: Bearer uc-..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`;
                        navigator.clipboard.writeText(cmd);
                        setUrlCopied(true);
                        setTimeout(() => setUrlCopied(false), 2000);
                      }}
                    >
                      {urlCopied ? (
                        <Check className="h-3 w-3 mr-1 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 mr-1" />
                      )}
                      {urlCopied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="p-3.5 text-[11px] font-mono text-green-400 overflow-x-auto leading-relaxed">
                    <code>{`curl "${serverBase}/${resourcePath}?url=${externalUrl}/<endpoint-path>" \\
  -H "Authorization: Bearer uc-..." \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'`}</code>
                  </pre>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3.5">
                  <p className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    What happens on each request
                  </p>
                  <ol className="text-[11px] space-y-1.5 text-muted-foreground">
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">1.</span>
                      KeyControl validates the API key and checks preset permissions
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">2.</span>
                      Rate limits and IP restrictions are enforced
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">3.</span>
                      The request is forwarded to the upstream API with the real credentials
                    </li>
                    <li className="flex gap-2">
                      <span className="text-primary font-bold shrink-0">4.</span>
                      The response is returned to the consumer, and usage is logged
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="px-7 pb-5 flex justify-end">
              <Button size="sm" className="px-5" onClick={finish}>
                <Rocket className="h-3.5 w-3.5 mr-1.5" />
                Done — Start Using KeyControl
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Tooltip content ───────────────────────────────────────────────
  const getTooltipContent = (): {
    title: string;
    content: string;
    action?: string;
    onAction?: () => void;
    showClickHint?: boolean;
  } | null => {
    // Field-level guidance
    if (phase === "guide-resource-fields") {
      if (fieldIndex < RESOURCE_FIELDS.length) {
        return {
          title: RESOURCE_FIELDS[fieldIndex].title,
          content: RESOURCE_FIELDS[fieldIndex].content,
          action: fieldIndex < RESOURCE_FIELDS.length - 1 ? "Next Field →" : "Now fill in & submit →",
          onAction: advanceField,
        };
      }
      return {
        title: "Create Your Resource",
        content: 'Fill in the required fields and click "Save" to create your resource.',
      };
    }
    if (phase === "guide-group-fields") {
      if (fieldIndex < GROUP_FIELDS.length) {
        return {
          title: GROUP_FIELDS[fieldIndex].title,
          content: GROUP_FIELDS[fieldIndex].content,
          action: "Fill in & submit →",
          onAction: advanceField,
        };
      }
      return { title: "Create Your Group", content: 'Click "Save" to create the endpoint group.' };
    }
    if (phase === "guide-endpoint-fields") {
      if (fieldIndex < ENDPOINT_FIELDS.length) {
        return {
          title: ENDPOINT_FIELDS[fieldIndex].title,
          content: ENDPOINT_FIELDS[fieldIndex].content,
          action: "Fill in & submit →",
          onAction: advanceField,
        };
      }
      return { title: "Add Your Endpoint", content: 'Click "Save" to add this endpoint.' };
    }
    if (phase === "guide-preset-fields") {
      if (fieldIndex < PRESET_FIELDS.length) {
        return {
          title: PRESET_FIELDS[fieldIndex].title,
          content: PRESET_FIELDS[fieldIndex].content,
          action: "Configure & submit →",
          onAction: advanceField,
        };
      }
      return {
        title: "Configure & Create",
        content: 'Click "Configure Resources & Endpoints" to select your resource and endpoint group, then submit.',
      };
    }
    if (phase === "guide-apikey-fields") {
      if (fieldIndex < APIKEY_FIELDS.length) {
        return {
          title: APIKEY_FIELDS[fieldIndex].title,
          content: APIKEY_FIELDS[fieldIndex].content,
          action: fieldIndex < APIKEY_FIELDS.length - 1 ? "Next Field →" : "Fill in & submit →",
          onAction: advanceField,
        };
      }
      return { title: "Issue Your Key", content: 'Click "Create API Key" to generate your key.' };
    }

    // Button spotlight phases — tell user to click the button
    if (phase === "click-new-resource") {
      return {
        title: "Create a Resource",
        content: "A resource represents an external API you want to proxy — like OpenAI, Stripe, or your own backend.",
        showClickHint: true,
      };
    }
    if (phase === "click-new-group") {
      return {
        title: "Add an Endpoint Group",
        content: "Endpoint groups organize related API endpoints. They let you control which endpoints different API keys can access.",
        showClickHint: true,
      };
    }
    if (phase === "click-add-endpoint") {
      return {
        title: "Add an Endpoint",
        content: "Define the specific API endpoints that belong to this group. These are the paths your consumers will be able to call.",
        showClickHint: true,
      };
    }
    if (phase === "click-new-preset") {
      return {
        title: "Create a Preset",
        content: "Presets bundle access rules — which resources, endpoints, rate limits, and IP restrictions apply. Each API key gets one preset.",
        showClickHint: true,
      };
    }
    if (phase === "click-new-apikey") {
      return {
        title: "Issue an API Key",
        content: "API keys are credentials for your consumers. Each key inherits permissions from its assigned preset.",
        showClickHint: true,
      };
    }

    // Navigation spotlight phases — tell user to click the highlighted link
    if (phase === "click-resource-manage") {
      const name = tracked.newResourceName || "your new resource";
      return {
        title: `Open "${name}"`,
        content: `Click "Manage" on "${name}" to configure its endpoint groups and endpoints.`,
        showClickHint: true,
      };
    }
    if (phase === "click-presets-nav" || phase === "click-presets-nav-final") {
      return {
        title: "Go to Presets",
        content: "Click the Presets link in the sidebar to continue.",
        showClickHint: true,
      };
    }
    if (phase === "click-apikeys-nav") {
      return {
        title: "Go to API Keys",
        content: "Click the API Keys link in the sidebar to issue a key for your preset.",
        showClickHint: true,
      };
    }

    // Preset/URL phases
    if (phase === "show-preset") {
      return {
        title: "Your Preset",
        content: "This is the preset you just created. It controls which resources and endpoints associated API keys can access.",
        action: "See the accessible resources →",
        onAction: () => setPhase("open-access-modal"),
      };
    }
    if (phase === "open-access-modal") {
      return {
        title: "View Accessible Resources",
        content: "Click this button to see the gateway URLs for the endpoints this preset can access.",
        showClickHint: true,
      };
    }
    if (phase === "highlight-url") {
      return {
        title: "Copy the Gateway URL",
        content: "Each endpoint has a copyable gateway URL. Use this URL instead of the external API — send requests in the exact same format.",
        action: "See how it all works →",
        onAction: () => {
          const closeBtn = document.querySelector("[role='dialog'] button[class*='absolute']");
          if (closeBtn) (closeBtn as HTMLElement).click();
          setTimeout(() => setPhase("final"), 400);
        },
      };
    }

    return null;
  };

  const tip = getTooltipContent();
  if (!tip) return null;

  // Don't render tooltip if there's no highlighted element to anchor to
  if (!highlightedRef.current) return null;

  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;


  // Tooltip content — shared between portal and non-portal rendering
  const tooltipContent = (
    <div
      data-tour-tooltip
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        // During dialog phases, Radix sets body.style.pointerEvents = "none".
        // We need explicit pointer-events: auto to receive clicks.
        pointerEvents: "auto",
      }}
      className={cn(
        "z-[10001] w-80 rounded-xl border bg-popover text-popover-foreground shadow-2xl",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        isDialogPhase && "ring-2 ring-primary/30"
      )}
    >
      {/* Arrow */}
      <div
        ref={arrowRef}
        className="absolute w-2.5 h-2.5 bg-popover border rotate-45"
        style={{
          left: arrowX != null ? arrowX : "",
          top: arrowY != null ? arrowY : "-5px",
        }}
      />

      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-semibold">{tip.title}</h4>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground transition-colors -mr-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {tip.content}
        </p>

        {/* Click hint for button-spotlight phases */}
        {tip.showClickHint && (
          <div className="flex items-center gap-1.5 mt-2.5 text-primary">
            <MousePointerClick className="h-3.5 w-3.5 animate-pulse" />
            <span className="text-[11px] font-medium">Click the highlighted button</span>
          </div>
        )}
      </div>

      {tip.action && (
        <div className="px-4 pb-3 flex justify-end">
          <Button
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={tip.onAction}
          >
            {tip.action}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>

      {/*
        During dialog phases, Radix sets body.style.pointerEvents = "none" and
        only gives the dialog content pointer-events: auto.  Our tooltip would
        inherit "none" and be unclickable.  By portaling to document.body we
        make it a sibling of Radix's own portal, so pointer-events: auto works.
        During non-dialog phases this is not needed.
      */}
      {isDialogPhase
        ? createPortal(tooltipContent, document.body)
        : tooltipContent}
    </>
  );
}
