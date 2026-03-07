import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  X,
  Copy,
  Check,
  FileJson,
  ArrowUpRight,
  ArrowDownLeft,
  Globe,
  CalendarIcon,
  Activity,
  ActivitySquare,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parse } from "date-fns";
import { cn, copyToClipboard } from "@/lib/utils";
import api from "@/lib/api";
import type { LogEntry, Resource } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";

function LogsTableSkeleton() {
  return (
    <TableBody>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-3 w-28" /></TableCell>
          <TableCell><Skeleton className="h-5 w-12 rounded" /></TableCell>
          <TableCell><Skeleton className="h-3 w-48" /></TableCell>
          <TableCell><Skeleton className="h-5 w-10 rounded" /></TableCell>
          <TableCell><Skeleton className="h-5 w-10 rounded" /></TableCell>
          <TableCell><Skeleton className="h-3 w-14" /></TableCell>
          <TableCell><Skeleton className="h-3 w-20" /></TableCell>
          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
  HEAD: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  OPTIONS: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

function statusColor(code: number): string {
  if (code >= 200 && code < 300)
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (code >= 400 && code < 500)
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  if (code >= 500)
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 0,
  });

  const [projects, setProjects] = useState<Resource[]>([]);

  const [filters, setFilters] = useState({
    resource_id: "",
    method: "",
    status_code: "",
    date_from: "",
    date_to: "",
  });

  const [logIpAddresses, setLogIpAddresses] = useState(false);
  const [loggingEnabled, setLoggingEnabled] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
    loadIpLoggingSetting();
  }, []);

  useEffect(() => {
    loadLogs(pagination.page, pagination.per_page);
  }, [filters]);

  const loadProjects = async () => {
    try {
      const res = await api.get("/resources");
      setProjects(res.data);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const loadLogs = useCallback(
    async (page = 1, perPage = 50) => {
      try {
        setLoading(true);
        const params: any = { page, per_page: perPage };
        if (filters.resource_id) params.resource_id = filters.resource_id;
        if (filters.method) params.method = filters.method;
        if (filters.status_code) params.status_code = filters.status_code;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;

        const res = await api.get("/logs", { params });
        setLogs(res.data.logs || []);
        setPagination(
          res.data.pagination || {
            page: 1,
            per_page: perPage,
            total: 0,
            total_pages: 0,
          },
        );
      } catch (error) {
        console.error("Failed to load logs:", error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  const loadIpLoggingSetting = async () => {
    try {
      const res = await api.get("/logs/settings");
      setLogIpAddresses(res.data.log_ip_addresses || false);
      setLoggingEnabled(res.data.logging_enabled !== false);
    } catch (error) {
      console.error("Failed to load logging settings:", error);
    }
  };

  const handleToggleIpLogging = async () => {
    try {
      await api.put("/logs/settings", {
        log_ip_addresses: !logIpAddresses,
      });
      setLogIpAddresses(!logIpAddresses);
      toast({
        title: "Success",
        description: `IP address logging ${!logIpAddresses ? "enabled" : "disabled"}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error ||
          "Failed to update IP logging setting",
      });
    }
  };

  const handleToggleLogging = async () => {
    try {
      await api.put("/logs/settings", {
        logging_enabled: !loggingEnabled,
      });
      setLoggingEnabled(!loggingEnabled);
      toast({
        title: "Success",
        description: `Request logging ${!loggingEnabled ? "enabled" : "disabled"}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error ||
          "Failed to update logging setting",
      });
    }
  };

  const goToPage = (p: number) => {
    if (p < 1 || p > pagination.total_pages) return;
    loadLogs(p, pagination.per_page);
  };

  const handlePerPageChange = (value: string) => {
    const perPage = parseInt(value, 10);
    loadLogs(1, perPage);
  };

  const clearFilters = () => {
    setFilters({
      resource_id: "",
      method: "",
      status_code: "",
      date_from: "",
      date_to: "",
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Request Logs</h2>
          <p className="text-muted-foreground">
            View all API requests and responses
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs(pagination.page, pagination.per_page)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleLogging}
            className={loggingEnabled
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
              : "border-red-500/50 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400 dark:border-red-500/30"
            }
          >
            {loggingEnabled ? (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Logging On
              </>
            ) : (
              <>
                <ActivitySquare className="h-4 w-4 mr-2" />
                Logging Off
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleIpLogging}
            className={logIpAddresses
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
              : ""
            }
          >
            {logIpAddresses ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                IP Logging On
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                IP Logging Off
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Logging disabled banner */}
      {!loggingEnabled && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <ActivitySquare className="h-5 w-5 flex-shrink-0" />
          <span>
            <strong>Request logging is disabled.</strong> Gateway requests are not being recorded.
            Toggle logging on to resume capturing request logs.
          </span>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Resource filter */}
            <div>
              <Label className="text-xs mb-1 block">Resource</Label>
              <Select
                value={filters.resource_id}
                onValueChange={(value) =>
                  setFilters({ ...filters, resource_id: value === "__all__" ? "" : value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Method filter */}
            <div>
              <Label className="text-xs mb-1 block">Method</Label>
              <Select
                value={filters.method}
                onValueChange={(value) =>
                  setFilters({ ...filters, method: value === "__all__" ? "" : value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status code filter */}
            <div>
              <Label className="text-xs mb-1 block">Status Code</Label>
              <Input
                type="number"
                placeholder="e.g. 200"
                className="h-9"
                value={filters.status_code}
                onChange={(e) =>
                  setFilters({ ...filters, status_code: e.target.value })
                }
              />
            </div>

            {/* Date from */}
            <div>
              <Label className="text-xs mb-1 block">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-full justify-start text-left font-normal",
                      !filters.date_from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date_from
                      ? format(parse(filters.date_from, "yyyy-MM-dd", new Date()), "MMM d, yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.date_from ? parse(filters.date_from, "yyyy-MM-dd", new Date()) : undefined}
                    onSelect={(date) =>
                      setFilters({ ...filters, date_from: date ? format(date, "yyyy-MM-dd") : "" })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date to */}
            <div>
              <Label className="text-xs mb-1 block">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-full justify-start text-left font-normal",
                      !filters.date_to && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.date_to
                      ? format(parse(filters.date_to, "yyyy-MM-dd", new Date()), "MMM d, yyyy")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.date_to ? parse(filters.date_to, "yyyy-MM-dd", new Date()) : undefined}
                    onSelect={(date) =>
                      setFilters({ ...filters, date_to: date ? format(date, "yyyy-MM-dd") : "" })
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs</CardTitle>
              <CardDescription>
                {pagination.total.toLocaleString()} total entries
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Per page</Label>
              <Select
                value={pagination.per_page.toString()}
                onValueChange={handlePerPageChange}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remote Status</TableHead>
                    <TableHead>R.T</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <LogsTableSkeleton />
              </Table>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No logs found
              {hasActiveFilters && " for the selected filters"}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remote Status</TableHead>
                    <TableHead>R.T</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${METHOD_COLORS[log.method?.toUpperCase()] || "bg-muted text-muted-foreground"}`}
                        >
                          {log.method}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-mono text-xs">
                        {log.url}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${statusColor(log.response_code)}`}
                        >
                          {log.response_code}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.upstream_status_code ? (
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${statusColor(log.upstream_status_code)}`}
                          >
                            {log.upstream_status_code}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">
                        {log.duration_ms != null ? (
                          log.duration_ms >= 1000
                            ? `${(log.duration_ms / 1000).toFixed(2)}s`
                            : `${log.duration_ms}ms`
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.ip_address || (
                          <span className="text-muted-foreground italic">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-primary hover:text-primary/80 px-2 h-7"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(1)} disabled={pagination.page <= 1}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.total_pages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(pagination.total_pages)} disabled={pagination.page >= pagination.total_pages}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (() => {
            const copyToClipboardLog = (text: string, section: string) => {
              copyToClipboard(text);
              setCopiedSection(section);
              setTimeout(() => setCopiedSection(null), 2000);
            };

            const formatJson = (raw: string) => {
              try {
                return JSON.stringify(JSON.parse(raw), null, 2);
              } catch {
                return raw;
              }
            };

            return (
              <div className="space-y-4">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50 border text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase font-medium">Method</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[selectedLog.method] || ''}`}>
                      {selectedLog.method}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase font-medium">Gateway</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(selectedLog.response_code)}`}>
                      {selectedLog.response_code}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-mono truncate">{selectedLog.url}</span>
                  </div>
                  {selectedLog.upstream_status_code && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs uppercase font-medium">Upstream</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(selectedLog.upstream_status_code)}`}>
                        {selectedLog.upstream_status_code}
                      </span>
                    </div>
                  )}
                  {selectedLog.duration_ms != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs uppercase font-medium">Duration</span>
                      <span className="text-xs font-mono">
                        {selectedLog.duration_ms >= 1000
                          ? `${(selectedLog.duration_ms / 1000).toFixed(2)}s`
                          : `${selectedLog.duration_ms}ms`}
                      </span>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs uppercase font-medium">IP</span>
                      <span className="text-xs font-mono">{selectedLog.ip_address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs uppercase font-medium">Time</span>
                    <span className="text-xs">{new Date(selectedLog.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Headers Section */}
                {selectedLog.headers && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Request Headers
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboardLog(formatJson(selectedLog.headers ?? ''), 'headers')}
                      >
                        {copiedSection === 'headers' ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedSection === 'headers' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all bg-background/50 max-h-48 overflow-y-auto">
                      {formatJson(selectedLog.headers ?? '')}
                    </pre>
                  </div>
                )}

                {/* Request Body Section */}
                {selectedLog.body && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Request Body
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboardLog(formatJson(selectedLog.body ?? ''), 'body')}
                      >
                        {copiedSection === 'body' ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedSection === 'body' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all bg-background/50 max-h-48 overflow-y-auto">
                      {formatJson(selectedLog.body ?? '')}
                    </pre>
                  </div>
                )}

                {/* Response Body Section */}
                {selectedLog.response_body && (
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                        Response Body
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboardLog(formatJson(selectedLog.response_body ?? ''), 'response')}
                      >
                        {copiedSection === 'response' ? <Check className="h-3 w-3 mr-1 text-green-500" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedSection === 'response' ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all bg-background/50 max-h-48 overflow-y-auto">
                      {formatJson(selectedLog.response_body)}
                    </pre>
                  </div>
                )}

                {/* Empty state */}
                {!selectedLog.headers && !selectedLog.body && !selectedLog.response_body && (
                  <p className="text-center text-muted-foreground italic py-8">No additional details available</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
