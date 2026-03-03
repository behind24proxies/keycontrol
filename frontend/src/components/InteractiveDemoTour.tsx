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
  MousePointerClick,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

// ── Storage key for tour progress ─────────────────────────────────────
const TOUR_PROGRESS_KEY = "keycontrol-tour-progress";

interface TourProgress {
  phase: Phase;
  fieldIndex: number;
  tracked: TrackedData;
}

function saveTourProgress(phase: Phase, fieldIndex: number, tracked: TrackedData) {
  try {
    sessionStorage.setItem(
      TOUR_PROGRESS_KEY,
      JSON.stringify({ phase, fieldIndex, tracked }),
    );
  } catch { /* ignore quota errors */ }
}

function loadTourProgress(): TourProgress | null {
  try {
    const raw = sessionStorage.getItem(TOUR_PROGRESS_KEY);
    if (raw) return JSON.parse(raw) as TourProgress;
  } catch { /* ignore parse errors */ }
  return null;
}

function clearTourProgress() {
  try {
    sessionStorage.removeItem(TOUR_PROGRESS_KEY);
  } catch { /* ignore */ }
}

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
  | "click-configure-resources"
  | "click-resource-checkbox"
  | "click-resource-usage-limit"
  | "click-resource-lease-time"
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
  "click-configure-resources",
  "click-resource-checkbox",
  "click-resource-usage-limit",
  "click-resource-lease-time",
];

// Dialog-dismiss fallback phases (documented inline in each guide-*-fields handler):
// guide-resource-fields → click-new-resource
// guide-group-fields    → click-new-group
// guide-endpoint-fields → click-add-endpoint
// guide-preset-fields   → click-new-preset
// guide-apikey-fields   → click-new-apikey

// ── Checklist steps ───────────────────────────────────────────────────
interface ChecklistStep {
  label: string;
  icon: typeof Folder;
  color: string;
  /** Phases where this step is considered completed */
  completedAfter: Phase[];
  /** Phases where this step is actively in progress */
  activePhases: Phase[];
}

const CHECKLIST_STEPS: ChecklistStep[] = [
  {
    label: "Create a Resource",
    icon: Folder,
    color: "text-blue-500",
    completedAfter: [
      "resource-created",
      "click-resource-manage",
      "click-new-group",
      "guide-group-fields",
      "group-created",
      "click-add-endpoint",
      "guide-endpoint-fields",
      "endpoint-created",
      "click-presets-nav",
      "click-new-preset",
      "guide-preset-fields",
      "preset-created",
      "click-apikeys-nav",
      "click-new-apikey",
      "guide-apikey-fields",
      "apikey-created",
      "click-presets-nav-final",
      "show-preset",
      "open-access-modal",
      "highlight-url",
      "final",
    ],
    activePhases: [
      "goto-resources",
      "click-new-resource",
      "guide-resource-fields",
    ],
  },
  {
    label: "Add Endpoint Group",
    icon: Folder,
    color: "text-blue-500",
    completedAfter: [
      "group-created",
      "click-add-endpoint",
      "guide-endpoint-fields",
      "endpoint-created",
      "click-presets-nav",
      "click-new-preset",
      "guide-preset-fields",
      "preset-created",
      "click-apikeys-nav",
      "click-new-apikey",
      "guide-apikey-fields",
      "apikey-created",
      "click-presets-nav-final",
      "show-preset",
      "open-access-modal",
      "highlight-url",
      "final",
    ],
    activePhases: [
      "click-resource-manage",
      "click-new-group",
      "guide-group-fields",
    ],
  },
  {
    label: "Add Endpoint",
    icon: Zap,
    color: "text-amber-500",
    completedAfter: [
      "endpoint-created",
      "click-presets-nav",
      "click-new-preset",
      "guide-preset-fields",
      "preset-created",
      "click-apikeys-nav",
      "click-new-apikey",
      "guide-apikey-fields",
      "apikey-created",
      "click-presets-nav-final",
      "show-preset",
      "open-access-modal",
      "highlight-url",
      "final",
    ],
    activePhases: ["click-add-endpoint", "guide-endpoint-fields"],
  },
  {
    label: "Create a Preset",
    icon: SlidersHorizontal,
    color: "text-violet-500",
    completedAfter: [
      "preset-created",
      "click-apikeys-nav",
      "click-new-apikey",
      "guide-apikey-fields",
      "apikey-created",
      "click-presets-nav-final",
      "show-preset",
      "open-access-modal",
      "highlight-url",
      "final",
    ],
    activePhases: [
      "click-presets-nav",
      "click-new-preset",
      "guide-preset-fields",
      "click-configure-resources",
      "click-resource-checkbox",
      "click-resource-usage-limit",
      "click-resource-lease-time",
    ],
  },
  {
    label: "Issue an API Key",
    icon: Key,
    color: "text-emerald-500",
    completedAfter: [
      "apikey-created",
      "click-presets-nav-final",
      "show-preset",
      "open-access-modal",
      "highlight-url",
      "final",
    ],
    activePhases: [
      "click-apikeys-nav",
      "click-new-apikey",
      "guide-apikey-fields",
    ],
  },
  {
    label: "Review Gateway URL",
    icon: Globe,
    color: "text-cyan-500",
    completedAfter: ["final"],
    activePhases: [
      "click-presets-nav-final",
      "show-preset",
      "open-access-modal",
      "highlight-url",
    ],
  },
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
    if (phase === "guide-resource-fields")
      return RESOURCE_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-group-fields")
      return GROUP_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-endpoint-fields")
      return ENDPOINT_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-preset-fields")
      return PRESET_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "guide-apikey-fields")
      return APIKEY_FIELDS[fieldIndex]?.placement || "right";
    if (phase === "show-preset" || phase === "open-access-modal")
      return "bottom";
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
    pollRef.current = () => {
      active = false;
    };
  }, []);

  // ── Highlight helpers ─────────────────────────────────────────────
  const highlightedRef = useRef<HTMLElement | null>(null);

  const clearHighlight = useCallback(() => {
    if (highlightedRef.current) {
      highlightedRef.current.classList.remove(
        "tour-highlight",
        "tour-highlight-field",
      );
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
            el.classList.add(
              isField ? "tour-highlight-field" : "tour-highlight",
            );
            highlightedRef.current = el;
            refs.setReference(el);
            resolve(el);
          } else {
            requestAnimationFrame(tryFind);
          }
        };
        requestAnimationFrame(tryFind);
        // Safety timeout: give up after 10 seconds
        setTimeout(() => {
          active = false;
          resolve(null);
        }, 10000);
      });
    },
    [refs, clearHighlight],
  );

  // ── Finish tour ───────────────────────────────────────────────────
  const closingRef = useRef(false);

  const finish = useCallback(() => {
    closingRef.current = true;
    // Immediately hide the tooltip DOM element to prevent flash
    const tooltipEl = document.querySelector("[data-tour-tooltip]");
    if (tooltipEl) (tooltipEl as HTMLElement).style.display = "none";
    stopPolling();
    clearHighlight();
    setPhase("intro");
    setFieldIndex(0);
    clearTourProgress(); // Clear saved progress on explicit finish/skip
    const closeBtn = document.querySelector(
      "[role='dialog'] button[class*='absolute']",
    );
    if (closeBtn) (closeBtn as HTMLElement).click();
    onFinish();
  }, [stopPolling, clearHighlight, onFinish]);

  // ── Restore or reset on activate ───────────────────────────────────
  useEffect(() => {
    if (active) {
      closingRef.current = false;
      clearHighlight();
      setUrlCopied(false);

      // Try to restore saved progress from sessionStorage
      const saved = loadTourProgress();
      if (saved && saved.phase !== "intro") {
        setTracked(saved.tracked);

        // Map dialog/unsafe phases to the nearest safe "click button" phase
        const safePhaseMap: Partial<Record<Phase, Phase>> = {
          "guide-resource-fields": "click-new-resource",
          "guide-group-fields": "click-new-group",
          "guide-endpoint-fields": "click-add-endpoint",
          "guide-preset-fields": "click-new-preset",
          "click-configure-resources": "click-new-preset",
          "click-resource-checkbox": "click-new-preset",
          "click-resource-usage-limit": "click-new-preset",
          "click-resource-lease-time": "click-new-preset",
          "guide-apikey-fields": "click-new-apikey",
          "highlight-url": "click-presets-nav-final",
          "open-access-modal": "click-presets-nav-final",
        };
        const safePhase = safePhaseMap[saved.phase] || saved.phase;

        // Navigate to the correct page for the restored phase
        const pageMap: Partial<Record<Phase, string>> = {
          "goto-resources": "/resources",
          "click-new-resource": "/resources",
          "resource-created": "/resources",
          "click-resource-manage": "/resources",
          "click-new-group": saved.tracked.newResourceId
            ? `/resources/${saved.tracked.newResourceId}` : "/resources",
          "click-add-endpoint": saved.tracked.newResourceId
            ? `/resources/${saved.tracked.newResourceId}` : "/resources",
          "click-presets-nav": "/presets",
          "click-new-preset": "/presets",
          "preset-created": "/presets",
          "click-apikeys-nav": "/api-keys",
          "click-new-apikey": "/api-keys",
          "apikey-created": "/api-keys",
          "click-presets-nav-final": "/presets",
          "show-preset": "/presets",
        };
        const page = pageMap[safePhase];

        setFieldIndex(safePhaseMap[saved.phase] ? 0 : saved.fieldIndex);

        if (page) {
          navigate(page);
          // Delay setting phase so the page DOM is ready
          setTimeout(() => setPhase(safePhase), 400);
        } else {
          setPhase(safePhase);
        }
      } else {
        // Fresh start
        setPhase("intro");
        setFieldIndex(0);
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
    }
    return () => {
      stopPolling();
      clearHighlight();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stopPolling, clearHighlight]);

  // ── Persist progress to sessionStorage ─────────────────────────────
  useEffect(() => {
    if (active && phase !== "intro") {
      saveTourProgress(phase, fieldIndex, tracked);
    }
  }, [active, phase, fieldIndex, tracked]);

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
          } catch {
            /* ignore */
          }
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
          const selector =
            fieldIndex < fields.length
              ? fields[fieldIndex].selector
              : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // Poll for dialog close -> resource created
          // Rail guard: if dialog dismissed without creation, fall back immediately
          {
            let dialogCheckDone = false;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && !dialogCheckDone) {
                dialogCheckDone = true;
                // Dialog just closed — one immediate API check
                api
                  .get("/resources")
                  .then((res) => {
                    const projects = res.data || [];
                    if (
                      projects.length > trackedRef.current.initialResourceCount
                    ) {
                      const newest = projects.reduce((a: any, b: any) =>
                        a.id > b.id ? a : b,
                      );
                      setTracked((t) => ({
                        ...t,
                        newResourceId: newest.id,
                        newResourceName: newest.name,
                        newResourcePath: newest.unique_path || "",
                        newResourceExternalUrl:
                          newest.external_api_base_url ||
                          newest.external_api_url ||
                          "",
                      }));
                      stopPolling();
                      setPhase("resource-created");
                    } else {
                      // Dialog dismissed without creation — fall back
                      stopPolling();
                      setFieldIndex(0);
                      setPhase("click-new-resource");
                    }
                  })
                  .catch(() => { dialogCheckDone = false; }); // retry on error
              }
            });
          }
          break;
        }

        // ── Resource created — auto-advance after brief pause ────
        case "resource-created": {
          clearHighlight();
          setTimeout(() => setPhase("click-resource-manage"), 400);
          break;
        }

        // ── Spotlight the new resource's Manage button ────────
        case "click-resource-manage": {
          if (trackedRef.current.newResourceId) {
            await highlightElement(
              `[data-tour-resource="${trackedRef.current.newResourceId}"]`,
            );
            // rAF poll: instant URL change detection
            startRafPoll(() => {
              if (
                window.location.pathname.includes(
                  `/resources/${trackedRef.current.newResourceId}`,
                )
              ) {
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
            api
              .get(`/resources/${trackedRef.current.newResourceId}`)
              .then((res) => {
                setTracked((t) => ({
                  ...t,
                  initialGroupCount: res.data?.endpoint_groups?.length || 0,
                }));
              })
              .catch(() => {});
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
          const selector =
            fieldIndex < fields.length
              ? fields[fieldIndex].selector
              : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // Poll for dialog close -> group created
          // Rail guard: if dialog dismissed without creation, fall back immediately
          {
            let dialogCheckDone = false;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && trackedRef.current.newResourceId && !dialogCheckDone) {
                dialogCheckDone = true;
                api
                  .get(`/resources/${trackedRef.current.newResourceId}`)
                  .then((res) => {
                    const groups = res.data?.endpoint_groups || [];
                    if (groups.length > trackedRef.current.initialGroupCount) {
                      setTracked((t) => ({ ...t, initialEndpointCount: 0 }));
                      stopPolling();
                      setPhase("group-created");
                    } else {
                      // Dialog dismissed without creation — fall back
                      stopPolling();
                      setFieldIndex(0);
                      setPhase("click-new-group");
                    }
                  })
                  .catch(() => { dialogCheckDone = false; });
              }
            });
          }
          break;
        }

        // ── Group created — auto-advance after brief pause ─────
        case "group-created": {
          clearHighlight();
          setTimeout(() => setPhase("click-add-endpoint"), 400);
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
          const selector =
            fieldIndex < fields.length
              ? fields[fieldIndex].selector
              : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // Rail guard: if dialog dismissed without creation, fall back immediately
          {
            let dialogCheckDone = false;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && trackedRef.current.newResourceId && !dialogCheckDone) {
                dialogCheckDone = true;
                api
                  .get(`/resources/${trackedRef.current.newResourceId}`)
                  .then((res) => {
                    const groups = res.data?.endpoint_groups || [];
                    const hasEndpoints = groups.some(
                      (g: any) => g.endpoints && g.endpoints.length > 0,
                    );
                    if (hasEndpoints) {
                      stopPolling();
                      setPhase("endpoint-created");
                    } else {
                      // Dialog dismissed without creation — fall back
                      stopPolling();
                      setFieldIndex(0);
                      setPhase("click-add-endpoint");
                    }
                  })
                  .catch(() => { dialogCheckDone = false; });
              }
            });
          }
          break;
        }

        // ── Endpoint created — auto-advance after brief pause ───
        case "endpoint-created": {
          clearHighlight();
          setTimeout(() => setPhase("click-presets-nav"), 400);
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
          api
            .get("/presets")
            .then((res) => {
              setTracked((t) => ({
                ...t,
                initialPresetCount: res.data?.length || 0,
              }));
            })
            .catch(() => {});
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
          const selector =
            fieldIndex < fields.length
              ? fields[fieldIndex].selector
              : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // When all fields are done, advance to configure-resources
          if (fieldIndex >= fields.length) {
            // Wait briefly then move to next phase
            setTimeout(() => setPhase("click-configure-resources"), 600);
          }
          // Rail guard: if dialog dismissed without creation, fall back immediately
          {
            let dialogCheckDone = false;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && !dialogCheckDone) {
                dialogCheckDone = true;
                api
                  .get("/presets")
                  .then((res) => {
                    const presets = res.data || [];
                    if (presets.length > trackedRef.current.initialPresetCount) {
                      // Preset was created (maybe via quick submit)
                      const newest = presets.reduce((a: any, b: any) =>
                        a.id > b.id ? a : b,
                      );
                      setTracked((t) => ({ ...t, newPresetName: newest.name }));
                      stopPolling();
                      setPhase("preset-created");
                    } else {
                      // Dialog dismissed without creation — fall back
                      stopPolling();
                      setFieldIndex(0);
                      setPhase("click-new-preset");
                    }
                  })
                  .catch(() => { dialogCheckDone = false; });
              }
            });
          }
          break;
        }

        // ── Click "Configure Resources & Endpoints" button ────
        case "click-configure-resources": {
          await highlightElement("[data-tour-configure-resources]", true);
          // Poll for the resource picker dialog to open
          // Rail guard: if the outer preset dialog is dismissed, fall back immediately
          startRafPoll(() => {
            const picker = document.querySelector("[data-tour-resource-item]");
            if (picker) {
              stopPolling();
              setPhase("click-resource-checkbox");
              return true;
            }
            // Check if the preset dialog itself was dismissed
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) {
              stopPolling();
              setFieldIndex(0);
              setPhase("click-new-preset");
              return true;
            }
          });
          break;
        }

        // ── Click the resource checkbox ───────────────────────
        case "click-resource-checkbox": {
          if (trackedRef.current.newResourceId) {
            await highlightElement(
              `[data-tour-resource-item="${trackedRef.current.newResourceId}"]`,
              true,
            );
            // Poll for the resource to be checked
            // Rail guard: if resource picker is dismissed, fall back to configure-resources
            startRafPoll(() => {
              const checkbox = document.querySelector(
                `[data-tour-resource-checkbox="${trackedRef.current.newResourceId}"]`,
              );
              if (
                checkbox &&
                checkbox.getAttribute("data-state") === "checked"
              ) {
                stopPolling();
                setPhase("click-resource-usage-limit");
                return true;
              }
              // If the resource picker item is gone, the picker was dismissed
              const item = document.querySelector("[data-tour-resource-item]");
              if (!item) {
                // Check if the whole preset dialog is also gone
                const dialog = document.querySelector('[role="dialog"]');
                if (!dialog) {
                  stopPolling();
                  setFieldIndex(0);
                  setPhase("click-new-preset");
                  return true;
                } else {
                  // Preset dialog still open but picker closed — re-show configure button
                  stopPolling();
                  setPhase("click-configure-resources");
                  return true;
                }
              }
            });
          }
          break;
        }

        // ── Click the usage limit (Zap) button ────────────────
        case "click-resource-usage-limit": {
          if (trackedRef.current.newResourceId) {
            await highlightElement(
              `[data-tour-resource-usage-limit="${trackedRef.current.newResourceId}"]`,
              true,
            );
          }
          break;
        }

        // ── Click the lease time (Timer) button ──────────────
        case "click-resource-lease-time": {
          if (trackedRef.current.newResourceId) {
            await highlightElement(
              `[data-tour-resource-lease-time="${trackedRef.current.newResourceId}"]`,
              true,
            );
          }
          // Poll for preset creation (user will close picker and submit)
          {
            let lastApiCall = 0;
            startRafPoll(() => {
              const now = Date.now();
              if (now - lastApiCall < 400) return;
              lastApiCall = now;
              api
                .get("/presets")
                .then((res) => {
                  const presets = res.data || [];
                  if (presets.length > trackedRef.current.initialPresetCount) {
                    const newest = presets.reduce((a: any, b: any) =>
                      a.id > b.id ? a : b,
                    );
                    setTracked((t) => ({ ...t, newPresetName: newest.name }));
                    stopPolling();
                    setPhase("preset-created");
                  }
                })
                .catch(() => {});
            });
          }
          break;
        }

        // ── Preset created — auto-advance after brief pause ────
        case "preset-created": {
          clearHighlight();
          setTimeout(() => setPhase("click-apikeys-nav"), 400);
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
          api
            .get("/api-keys")
            .then((res) => {
              setTracked((t) => ({
                ...t,
                initialApiKeyCount: res.data?.api_keys?.length || 0,
              }));
            })
            .catch(() => {});
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
          const selector =
            fieldIndex < fields.length
              ? fields[fieldIndex].selector
              : '[role="dialog"] button[type="submit"]';
          await highlightElement(selector, true);
          // Rail guard: if dialog dismissed without creation, fall back immediately
          {
            let dialogCheckDone = false;
            startRafPoll(() => {
              const dialog = document.querySelector('[role="dialog"]');
              if (!dialog && !dialogCheckDone) {
                dialogCheckDone = true;
                api
                  .get("/api-keys")
                  .then((res) => {
                    const keys = res.data?.api_keys || [];
                    if (keys.length > trackedRef.current.initialApiKeyCount) {
                      stopPolling();
                      setPhase("apikey-created");
                    } else {
                      // Dialog dismissed without creation — fall back
                      stopPolling();
                      setFieldIndex(0);
                      setPhase("click-new-apikey");
                    }
                  })
                  .catch(() => { dialogCheckDone = false; });
              }
            });
          }
          break;
        }

        // ── API key created — auto-advance after brief pause ───
        case "apikey-created": {
          clearHighlight();
          setTimeout(() => setPhase("click-presets-nav-final"), 400);
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
              `[data-preset-name="${trackedRef.current.newPresetName}"]`,
            );
          }
          break;
        }

        // ── Open access modal ────────────────────────────────
        case "open-access-modal": {
          if (trackedRef.current.newPresetName) {
            // Spotlight the access button and let user click
            await highlightElement(
              `[data-access-btn="${trackedRef.current.newPresetName}"]`,
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

  // ── Checklist helper ──────────────────────────────────────────────
  const renderChecklist = (compact = false) => (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {CHECKLIST_STEPS.map((step, i) => {
        const completed = step.completedAfter.includes(phase);
        const isActive = step.activePhases.includes(phase);
        return (
          <div
            key={i}
            className={cn(
              "flex items-center gap-2.5 py-1.5 px-2 rounded-md transition-all duration-200",
              completed && "opacity-60",
              isActive && "bg-primary/5 ring-1 ring-primary/20",
              !completed && !isActive && "opacity-40",
            )}
          >
            {completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            ) : isActive ? (
              <Circle className="h-4 w-4 text-primary shrink-0 animate-pulse" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                completed && "line-through text-muted-foreground",
                isActive && "text-foreground",
                !completed && !isActive && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  // ── Phase: Intro ──────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/50" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="bg-popover border rounded-xl max-w-md w-full shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

            <div className="px-6 pt-5 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    Set Up Your Gateway
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Hands-on walkthrough — about 3 minutes
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                We'll guide you through creating everything you need to start
                proxying API requests.
              </p>

              {renderChecklist()}
            </div>

            <div className="px-6 pb-4 flex items-center justify-between">
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

  // ── Auto-advance from success phases (no modal) ─────────────────────
  const SUCCESS_TRANSITIONS: Record<string, Phase> = {
    "resource-created": "click-resource-manage",
    "group-created": "click-add-endpoint",
    "endpoint-created": "click-presets-nav",
    "preset-created": "click-apikeys-nav",
    "apikey-created": "click-presets-nav-final",
  };

  if (phase in SUCCESS_TRANSITIONS) {
    // Render just the floating checklist during the brief auto-advance pause
    // (the actual setTimeout is in the useEffect's case handler)
    return (
      <div className="fixed bottom-6 right-6 z-[9999] w-64 bg-popover border rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-semibold">Tour Progress</span>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <div className="px-4 pb-3">{renderChecklist(true)}</div>
      </div>
    );
  }

  // ── Phase: Final explainer ────────────────────────────────────────
  if (phase === "final") {
    const serverBase = `${window.location.protocol}//${window.location.hostname}:3001`;
    const resourcePath = tracked.newResourcePath || "<path>";
    const externalUrl =
      tracked.newResourceExternalUrl || "https://api.example.com";
    const curlCmd = `curl "${serverBase}/${resourcePath}/<endpoint-path>" \\\n  -H "Authorization: Bearer uc-..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`;

    return (
      <>
        <div className="fixed inset-0 z-[9998] bg-black/60" />
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div
            className="bg-popover border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success header */}
            <div className="relative bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-green-500/15 ring-1 ring-green-500/20">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold tracking-tight">
                    Your Gateway is Ready
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All steps completed — you're ready to proxy requests
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5 space-y-4">
              {/* How it works — compact flow */}
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  How it works
                </p>
                <div className="space-y-2">
                  {[
                    "Send requests to your KeyControl gateway URL instead of the external API",
                    "Include your API key in the Authorization header",
                    "KeyControl validates permissions, enforces limits, and forwards the request",
                    "The response is returned to your consumer — the real API key stays hidden",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* URL comparison */}
              <div className="rounded-xl border overflow-hidden">
                <div className="grid grid-cols-[auto_1fr] text-[11px]">
                  <div className="px-3 py-2 bg-destructive/5 border-b border-r flex items-center">
                    <span className="font-semibold text-destructive/70">
                      BEFORE
                    </span>
                  </div>
                  <div className="px-3 py-2 border-b">
                    <code className="font-mono text-muted-foreground break-all">
                      {externalUrl}/&lt;endpoint-path&gt;
                    </code>
                  </div>
                  <div className="px-3 py-2 bg-primary/5 border-r flex items-center">
                    <span className="font-semibold text-primary">AFTER</span>
                  </div>
                  <div className="px-3 py-2">
                    <code className="font-mono text-primary break-all">
                      {serverBase}/{resourcePath}/&lt;endpoint-path&gt;
                    </code>
                  </div>
                </div>
              </div>

              {/* Curl example */}
              <div className="rounded-xl overflow-hidden border bg-[hsl(220,15%,8%)]">
                <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
                    Example request
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/5"
                    onClick={() => {
                      navigator.clipboard.writeText(curlCmd);
                      setUrlCopied(true);
                      setTimeout(() => setUrlCopied(false), 2000);
                    }}
                  >
                    {urlCopied ? (
                      <Check className="h-3 w-3 mr-1 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {urlCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <pre className="p-3.5 text-[11px] font-mono text-green-400/90 overflow-x-auto leading-relaxed">
                  <code>{curlCmd}</code>
                </pre>
              </div>

              {/* Done button */}
              <div className="flex justify-end pt-1">
                <Button
                  className="px-6 bg-green-600 hover:bg-green-700 text-white"
                  onClick={finish}
                >
                  <Rocket className="h-3.5 w-3.5 mr-2" />
                  Start Using KeyControl
                </Button>
              </div>
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
          action:
            fieldIndex < RESOURCE_FIELDS.length - 1
              ? "Next Field →"
              : "Now fill in & submit →",
          onAction: advanceField,
        };
      }
      return {
        title: "Create Your Resource",
        content:
          'Fill in the required fields and click "Save" to create your resource.',
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
      return {
        title: "Create Your Group",
        content: 'Click "Save" to create the endpoint group.',
      };
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
      return {
        title: "Add Your Endpoint",
        content: 'Click "Save" to add this endpoint.',
      };
    }
    if (phase === "guide-preset-fields") {
      if (fieldIndex < PRESET_FIELDS.length) {
        return {
          title: PRESET_FIELDS[fieldIndex].title,
          content: PRESET_FIELDS[fieldIndex].content,
          action: "Configure resources →",
          onAction: advanceField,
        };
      }
      return {
        title: "Configure Resources",
        content:
          'Click "Configure Resources & Endpoints" to select your resource.',
      };
    }
    if (phase === "click-configure-resources") {
      return {
        title: "Configure Resources & Endpoints",
        content:
          "Click this button to open the resource picker and select which resources and endpoint groups this preset can access.",
        showClickHint: true,
      };
    }
    if (phase === "click-resource-checkbox") {
      const resName = tracked.newResourceName || "your resource";
      return {
        title: `Select "${resName}"`,
        content: `Check the checkbox next to "${resName}" to grant this preset access to it and its endpoint groups.`,
        showClickHint: true,
      };
    }
    if (phase === "click-resource-usage-limit") {
      return {
        title: "Set Usage Limit (Optional)",
        content:
          "Click the ⚡ icon to set a maximum number of requests allowed for this resource. You can skip this for unlimited access.",
        action: "Skip & continue →",
        onAction: () => setPhase("click-resource-lease-time"),
      };
    }
    if (phase === "click-resource-lease-time") {
      return {
        title: "Set Lease Time (Optional)",
        content:
          "Click the ⏱ icon to set how long access lasts, or skip and close this picker to submit your preset.",
        action: "Close picker & submit →",
        onAction: () => {
          // Close the inner resource picker dialog by clicking the "Done" button
          const dialogs = document.querySelectorAll('[role="dialog"]');
          // The resource picker dialog is the innermost (last) dialog
          const innerDialog = dialogs[dialogs.length - 1];
          if (innerDialog) {
            // Find the "Done" button specifically
            const buttons = innerDialog.querySelectorAll("button");
            for (const btn of buttons) {
              if (btn.textContent?.trim() === "Done") {
                btn.click();
                break;
              }
            }
          }
          // After resource picker closes, highlight the preset submit button
          setTimeout(() => {
            highlightElement('[role="dialog"] button[type="submit"]', true);
          }, 300);
        },
      };
    }
    if (phase === "guide-apikey-fields") {
      if (fieldIndex < APIKEY_FIELDS.length) {
        return {
          title: APIKEY_FIELDS[fieldIndex].title,
          content: APIKEY_FIELDS[fieldIndex].content,
          action:
            fieldIndex < APIKEY_FIELDS.length - 1
              ? "Next Field →"
              : "Fill in & submit →",
          onAction: advanceField,
        };
      }
      return {
        title: "Issue Your Key",
        content: 'Click "Create API Key" to generate your key.',
      };
    }

    // Button spotlight phases — tell user to click the button
    if (phase === "click-new-resource") {
      return {
        title: "Create a Resource",
        content:
          "A resource represents an external API you want to proxy — like OpenAI, Stripe, or your own backend.",
        showClickHint: true,
      };
    }
    if (phase === "click-new-group") {
      return {
        title: "Add an Endpoint Group",
        content:
          "Endpoint groups organize related API endpoints. They let you control which endpoints different API keys can access.",
        showClickHint: true,
      };
    }
    if (phase === "click-add-endpoint") {
      return {
        title: "Add an Endpoint",
        content:
          "Define the specific API endpoints that belong to this group. These are the paths your consumers will be able to call.",
        showClickHint: true,
      };
    }
    if (phase === "click-new-preset") {
      return {
        title: "Create a Preset",
        content:
          "Presets bundle access rules — which resources, endpoints, rate limits, and IP restrictions apply. Each API key gets one preset.",
        showClickHint: true,
      };
    }
    if (phase === "click-new-apikey") {
      return {
        title: "Issue an API Key",
        content:
          "API keys are credentials for your consumers. Each key inherits permissions from its assigned preset.",
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
        content:
          "Click the API Keys link in the sidebar to issue a key for your preset.",
        showClickHint: true,
      };
    }

    // Preset/URL phases
    if (phase === "show-preset") {
      return {
        title: "Your Preset",
        content:
          "This is the preset you just created. It controls which resources and endpoints associated API keys can access.",
        action: "See the accessible resources →",
        onAction: () => setPhase("open-access-modal"),
      };
    }
    if (phase === "open-access-modal") {
      return {
        title: "View Accessible Resources",
        content:
          "Click this button to see the gateway URLs for the endpoints this preset can access.",
        showClickHint: true,
      };
    }
    if (phase === "highlight-url") {
      return {
        title: "Copy the Gateway URL",
        content:
          "Each endpoint has a copyable gateway URL. Use this URL instead of the external API — send requests in the exact same format.",
        action: "See how it all works →",
        onAction: () => {
          // Immediately hide tooltip and clear highlight before closing dialog
          // to prevent the tooltip from flashing to a default position
          const tooltipEl = document.querySelector("[data-tour-tooltip]");
          if (tooltipEl) (tooltipEl as HTMLElement).style.display = "none";
          clearHighlight();
          const closeBtn = document.querySelector(
            "[role='dialog'] button[class*='absolute']",
          );
          if (closeBtn) (closeBtn as HTMLElement).click();
          setTimeout(() => setPhase("final"), 400);
        },
      };
    }

    return null;
  };

  const tip = getTooltipContent();
  if (!tip) return null;

  // Don't render tooltip if closing or there's no highlighted element to anchor to
  if (closingRef.current) return null;
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
        isDialogPhase && "ring-2 ring-primary/30",
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
            <span className="text-[11px] font-medium">
              Click the highlighted button
            </span>
          </div>
        )}
      </div>

      {tip.action && (
        <div className="px-4 pb-3 flex justify-end">
          <Button size="sm" className="h-7 px-3 text-xs" onClick={tip.onAction}>
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

      {/* ── Persistent floating checklist ─────────────────────────── */}
      {!isDialogPhase && !(phase in SUCCESS_TRANSITIONS) && (
        <div className="fixed bottom-6 right-6 z-[9999] w-64 bg-popover border rounded-xl shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <span className="text-xs font-semibold">Tour Progress</span>
            <button
              onClick={finish}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="px-4 pb-3">{renderChecklist(true)}</div>
        </div>
      )}
    </>
  );
}
