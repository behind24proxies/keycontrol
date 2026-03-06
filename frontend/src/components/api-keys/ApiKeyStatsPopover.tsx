import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { BarChart3, Loader2, Zap, Timer } from "lucide-react";

interface ApiKeyStatsPopoverProps {
  ucId: number;
  statsCache: Record<number, any>;
  statsLoading: Record<number, boolean>;
  loadStats: (id: number) => Promise<void>;
}

export function ApiKeyStatsPopover({
  ucId,
  statsCache,
  statsLoading,
  loadStats,
}: ApiKeyStatsPopoverProps) {
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) loadStats(ucId);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>View usage stats</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        {statsLoading[ucId] && !statsCache[ucId] ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : statsCache[ucId] ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">
              Usage Stats
            </h4>

            {/* Request counts by time range */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-muted p-2 text-center">
                <p className="text-lg font-bold">
                  {statsCache[ucId].requests_24h.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  24h
                </p>
              </div>
              <div className="rounded-md bg-muted p-2 text-center">
                <p className="text-lg font-bold">
                  {statsCache[ucId].requests_7d.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  7 days
                </p>
              </div>
              <div className="rounded-md bg-muted p-2 text-center">
                <p className="text-lg font-bold">
                  {statsCache[ucId].requests_30d.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  30 days
                </p>
              </div>
            </div>

            {/* Response breakdown */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                All-time responses (
                {statsCache[ucId].total_requests.toLocaleString()}{" "}
                total)
              </p>
              <div className="flex gap-3 text-xs">
                <span className="text-green-600 dark:text-green-400">
                  ✓{" "}
                  {statsCache[ucId].success_count.toLocaleString()}{" "}
                  ok
                </span>
                <span className="text-yellow-600 dark:text-yellow-400">
                  ⚠{" "}
                  {statsCache[ucId].client_error_count.toLocaleString()}{" "}
                  4xx
                </span>
                <span className="text-red-600 dark:text-red-400">
                  ✕{" "}
                  {statsCache[ucId].server_error_count.toLocaleString()}{" "}
                  5xx
                </span>
              </div>
              {statsCache[ucId].avg_response_time_ms > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Avg response:{" "}
                  {statsCache[ucId].avg_response_time_ms}
                  ms
                </p>
              )}
            </div>

            {/* Top resources */}
            {statsCache[ucId].top_resources.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Top resources
                </p>
                <div className="space-y-1">
                  {statsCache[ucId].top_resources.map(
                    (r: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between text-xs"
                      >
                        <span className="truncate mr-2">
                          {r.resource_name}
                        </span>
                        <span className="font-mono text-muted-foreground flex-shrink-0">
                          {r.request_count.toLocaleString()}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Per-key global quota */}
            {(statsCache[ucId].usage_limit || statsCache[ucId].lease_duration_seconds) && (
              <div className="border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Key Quota
                </p>
                {statsCache[ucId].usage_limit && (
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" />
                      Usage
                    </span>
                    <span className="font-mono">
                      {Number(statsCache[ucId].global_usage_count).toLocaleString()}
                      {" / "}
                      {Number(statsCache[ucId].usage_limit).toLocaleString()}
                      {statsCache[ucId].global_usage_count >= statsCache[ucId].usage_limit && (
                        <span className="ml-1 text-red-500 font-semibold">EXCEEDED</span>
                      )}
                    </span>
                  </div>
                )}
                {statsCache[ucId].lease_duration_seconds && (
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3 text-blue-500" />
                      Lease
                    </span>
                    <span className="font-mono">
                      {statsCache[ucId].global_expiry_date
                        ? new Date(statsCache[ucId].global_expiry_date).getTime() < Date.now()
                          ? <span className="text-red-500 font-semibold">EXPIRED</span>
                          : `Expires ${new Date(statsCache[ucId].global_expiry_date).toLocaleString()}`
                        : "Not started"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Per-resource quota usage */}
            {Object.keys(statsCache[ucId].usage_counts).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Quota usage
                </p>
                <div className="space-y-1">
                  {Object.entries(statsCache[ucId].usage_counts).map(
                    ([key, count]: [string, any]) => (
                      <div
                        key={key}
                        className="flex justify-between text-xs"
                      >
                        <span className="truncate mr-2 font-mono">
                          {key}
                        </span>
                        <span className="font-mono text-muted-foreground flex-shrink-0">
                          {Number(count).toLocaleString()}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {statsCache[ucId].total_requests === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No requests recorded yet
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            Failed to load stats
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
