import { useState, useEffect, useCallback, useRef } from "react";
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
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tour step configuration ──────────────────────────────────────────
export interface TourStep {
  /** CSS selector for the target element */
  target: string;
  /** Step title */
  title: string;
  /** Step description */
  content: string;
  /** Preferred tooltip placement relative to target */
  placement?: Placement;
  /** Optional: navigate to a route before highlighting */
  navigateTo?: string;
  /** Custom label for the Next button on this step */
  nextLabel?: string;
}

export const TOUR_DONE_KEY = "keycontrol-tour-done";

export const tourSteps: TourStep[] = [
  {
    target: '[data-tour="dashboard"]',
    title: "Dashboard",
    content:
      "Your home base. See an overview of your API gateway — active keys, resource stats, and recent activity at a glance.",
    placement: "right",
  },
  {
    target: '[data-tour="resources"]',
    title: "Resources",
    content:
      "Register the external APIs you want to proxy (e.g. OpenAI, Stripe). Each resource gets a unique gateway path.",
    placement: "right",
  },
  {
    target: '[data-tour="presets"]',
    title: "Presets",
    content:
      "Bundle access rules — which resources, HTTP methods, rate limits, and IP restrictions apply. Each API key gets one preset.",
    placement: "right",
  },
  {
    target: '[data-tour="api-keys"]',
    title: "API Keys",
    content:
      "Generate credentials for your consumers. Keys inherit their preset's permissions and are used in the Authorization header.",
    placement: "right",
  },
  {
    target: '[data-tour="rate-limits"]',
    title: "Rate Limits",
    content:
      "Create rate limiting rules (e.g. 100 req/min) that can be applied to presets to throttle API usage.",
    placement: "right",
  },
  {
    target: '[data-tour="logs"]',
    title: "Logs",
    content:
      "Monitor every request flowing through your gateway in real time. Filter by method, status, key, or date range.",
    placement: "right",
  },
  {
    target: '[data-tour="settings"]',
    title: "Settings",
    content:
      "Customize the dashboard theme, manage security settings like 2FA and master API keys, and re-run this tour anytime.",
    placement: "right",
  },
  {
    target: '[data-tour="how-to-use"]',
    title: "See It in Action",
    content:
      'Click "How to Use" to launch an interactive demo — it creates a sample resource, preset, and API key, then walks you through the full gateway flow.',
    placement: "bottom",
    navigateTo: "/settings",
    nextLabel: "Launch Demo →",
  },
];

// ── Spotlight overlay ────────────────────────────────────────────────
function SpotlightOverlay({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null;

  const padding = 6;
  const radius = 8;
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;

  return (
    <svg
      className="fixed inset-0 z-[9998] pointer-events-auto"
      width="100%"
      height="100%"
      style={{ width: "100vw", height: "100vh" }}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={radius}
            ry={radius}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.5)"
        mask="url(#tour-spotlight-mask)"
      />
    </svg>
  );
}

// ── ProductTour component ────────────────────────────────────────────
interface ProductTourProps {
  active: boolean;
  onFinish: () => void;
  steps?: TourStep[];
}

export default function ProductTour({
  active,
  onFinish,
  steps = tourSteps,
}: ProductTourProps) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;

  const { refs, floatingStyles, middlewareData } = useFloating({
    placement: step?.placement || "right",
    middleware: [
      offset(16),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Find target element and measure it
  const measureTarget = useCallback(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      refs.setReference(el as HTMLElement);
    } else {
      setTargetRect(null);
    }
  }, [active, step, refs]);

  useEffect(() => {
    if (!active) return;
    setCurrent(0);
  }, [active]);

  useEffect(() => {
    // If step has a navigateTo, navigate first then wait for render
    if (step?.navigateTo) {
      navigate(step.navigateTo);
    }
    
    // Poll for the element to appear (handles async data loading delays)
    measureTarget();
    const interval = setInterval(measureTarget, 200);

    const handleReposition = () => measureTarget();
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [measureTarget, step, navigate]);

  const next = () => {
    if (isLast) {
      // Last step: finish the tour and trigger the demo tour
      localStorage.setItem(TOUR_DONE_KEY, "true");
      setCurrent(0);
      onFinish();
      // Click the How to Use button to trigger the demo tour
      const btn = document.querySelector('[data-tour="how-to-use"]');
      if (btn) (btn as HTMLElement).click();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const back = () => {
    if (!isFirst) setCurrent((c) => c - 1);
  };

  const finish = () => {
    localStorage.setItem(TOUR_DONE_KEY, "true");
    setCurrent(0);
    onFinish();
  };

  if (!active || !step) return null;

  // Arrow position
  const arrowSide = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
  }[step.placement?.split("-")[0] || "right"] as string;

  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;

  return (
    <>
      {/* Spotlight overlay — no click-to-dismiss */}
      <div className="fixed inset-0 z-[9998]">
        <SpotlightOverlay rect={targetRect} />
      </div>

      {/* Tooltip */}
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        className={cn(
          "z-[9999] w-72 rounded-xl border bg-popover text-popover-foreground shadow-xl",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        <div
          ref={arrowRef}
          className="absolute w-2.5 h-2.5 bg-popover border rotate-45"
          style={{
            left: arrowX != null ? arrowX : "",
            top: arrowY != null ? arrowY : "",
            [arrowSide]: "-5px",
            borderTop: arrowSide === "top" ? undefined : "none",
            borderLeft: arrowSide === "left" ? undefined : "none",
            borderRight: arrowSide === "right" ? undefined : "none",
            borderBottom: arrowSide === "bottom" ? undefined : "none",
          }}
        />

        {/* Content */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-semibold">{step.title}</h4>
            <button
              onClick={finish}
              className="text-muted-foreground hover:text-foreground transition-colors -mr-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {step.content}
          </p>
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">
            {current + 1} / {steps.length}
          </span>
          <div className="flex gap-1.5">
            {!isFirst && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={back}>
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" className="h-7 px-3 text-xs" onClick={next}>
              {step.nextLabel || (isLast ? "Finish" : "Next")}
              {!isLast && !step.nextLabel && <ArrowRight className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
