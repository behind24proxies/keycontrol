import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Key,
  Folder,
  SlidersHorizontal,
  Activity,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>

      {/* 4-stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card p-5 space-y-3">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border">
            <CardHeader className="pb-2 pt-5 px-5">
              <Skeleton className="h-3 w-32" />
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-3 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <Card className="border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                {["Time", "Method", "Endpoint", "Status", "Upstream", "Duration"].map((col) => (
                  <TableHead key={col} className="h-9">
                    <Skeleton className="h-3 w-16" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-b last:border-0">
                  <TableCell className="py-2.5"><Skeleton className="h-3 w-28" /></TableCell>
                  <TableCell className="py-2.5"><Skeleton className="h-5 w-12 rounded" /></TableCell>
                  <TableCell className="py-2.5"><Skeleton className="h-3 w-40" /></TableCell>
                  <TableCell className="py-2.5"><Skeleton className="h-3 w-8" /></TableCell>
                  <TableCell className="py-2.5"><Skeleton className="h-3 w-8" /></TableCell>
                  <TableCell className="py-2.5"><Skeleton className="h-3 w-14" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  HEAD: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  OPTIONS: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

function statusBadge(code: number): string {
  if (code >= 200 && code < 300) return "text-green-600 dark:text-green-400";
  if (code >= 400 && code < 500) return "text-amber-600 dark:text-amber-400";
  if (code >= 500) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

interface DashboardStats {
  api_key_count: number;
  resource_count: number;
  preset_count: number;
  requests_24h: number;
  avg_response_time_ms: number;
  success_count: number;
  client_error_count: number;
  server_error_count: number;
  recent_logs: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await api.get("/logs/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading || !stats) {
    return <DashboardSkeleton />;
  }

  const totalRequests24h = stats.requests_24h || 1;
  const successPct = Math.round((stats.success_count / totalRequests24h) * 100);
  const clientErrPct = Math.round((stats.client_error_count / totalRequests24h) * 100);
  const serverErrPct = Math.round((stats.server_error_count / totalRequests24h) * 100);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gateway overview
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStats} className="h-8 text-xs">
          <RefreshCw className="h-3 w-3 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Stat Cards — Vercel style: number-forward, icon subtle */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border">
        {[
          { label: "API Keys", value: stats.api_key_count, icon: Key },
          { label: "Resources", value: stats.resource_count, icon: Folder },
          { label: "Presets", value: stats.preset_count, icon: SlidersHorizontal },
          { label: "Requests (24h)", value: stats.requests_24h.toLocaleString(), icon: Activity },
        ].map((item) => (
          <div key={item.label} className="bg-card p-5">
            <div className="flex items-center gap-1.5 mb-2">
              <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                {item.label}
              </span>
            </div>
            <p className="text-3xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Response Time */}
        <Card className="border">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold tabular-nums font-mono">
                {stats.avg_response_time_ms >= 1000
                  ? (stats.avg_response_time_ms / 1000).toFixed(2)
                  : stats.avg_response_time_ms}
              </span>
              <span className="text-sm text-muted-foreground">
                {stats.avg_response_time_ms >= 1000 ? "s" : "ms"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              24-hour average · {stats.requests_24h.toLocaleString()} requests
            </p>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="border">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {/* Bar */}
            {stats.requests_24h > 0 && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden flex mb-4">
                {successPct > 0 && (
                  <div className="bg-green-500 h-full" style={{ width: `${successPct}%` }} />
                )}
                {clientErrPct > 0 && (
                  <div className="bg-amber-500 h-full" style={{ width: `${clientErrPct}%` }} />
                )}
                {serverErrPct > 0 && (
                  <div className="bg-red-500 h-full" style={{ width: `${serverErrPct}%` }} />
                )}
              </div>
            )}
            <div className="flex gap-6 text-sm">
              <div>
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                <span className="text-muted-foreground">2xx</span>
                <span className="ml-1.5 font-medium tabular-nums">{stats.success_count}</span>
                {stats.requests_24h > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">({successPct}%)</span>
                )}
              </div>
              <div>
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                <span className="text-muted-foreground">4xx</span>
                <span className="ml-1.5 font-medium tabular-nums">{stats.client_error_count}</span>
                {stats.requests_24h > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">({clientErrPct}%)</span>
                )}
              </div>
              <div>
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5" />
                <span className="text-muted-foreground">5xx</span>
                <span className="ml-1.5 font-medium tabular-nums">{stats.server_error_count}</span>
                {stats.requests_24h > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">({serverErrPct}%)</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-sm font-medium mb-3">Recent Activity</h3>
        <Card className="border overflow-hidden">
          {stats.recent_logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No requests yet. Activity will appear once API keys receive traffic.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">Time</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">Method</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">Endpoint</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">Status</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9">Upstream</TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground h-9 text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent_logs.map((log: any) => (
                  <TableRow key={log.id} className="border-b last:border-0">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap py-2.5">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${METHOD_COLORS[log.method?.toUpperCase()] || "bg-muted text-muted-foreground"}`}
                      >
                        {log.method}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs py-2.5">
                      {log.url}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {log.response_code ? (
                        <span className={`text-xs font-mono font-medium ${statusBadge(log.response_code)}`}>
                          {log.response_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {log.upstream_status_code ? (
                        <span className={`text-xs font-mono font-medium ${statusBadge(log.upstream_status_code)}`}>
                          {log.upstream_status_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap tabular-nums text-right py-2.5 text-muted-foreground">
                      {log.duration_ms != null
                        ? log.duration_ms >= 1000
                          ? `${(log.duration_ms / 1000).toFixed(2)}s`
                          : `${log.duration_ms}ms`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
