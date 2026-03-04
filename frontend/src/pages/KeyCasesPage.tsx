import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResourceEndpointPicker,
  presetDefaultForm,
  type LookupItem,
  type ProjectWithGroups,
} from "@/components/PresetFormComponents";
import api from "@/lib/api";
import type { UseCase, Preset } from "@/lib/types";
import {
  Plus,
  Edit,
  Trash2,
  HelpCircle,
  Folder,
  Copy,
  Check,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Key,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  BarChart3,
  Loader2,
} from "lucide-react";

function ApiKeysTableSkeleton() {
  return (
    <TableBody>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-6 w-6" />
              <Skeleton className="h-6 w-6" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-20" />
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );
}

export default function KeyCasesPage() {
  const { toast } = useToast();
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    search: "",
    preset_id: "",
  });

  // Create/edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UseCase | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    notes: "",
    preset_id: "" as string,
  });
  const [originalFormData, setOriginalFormData] = useState<
    typeof formData | null
  >(null);

  // Presets lookup
  const [presets, setPresets] = useState<Preset[]>([]);

  // Change preset dialog
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetDialogUseCase, setPresetDialogUseCase] =
    useState<UseCase | null>(null);
  const [presetDialogValue, setPresetDialogValue] = useState("");
  const [presetDialogLoading, setPresetDialogLoading] = useState(false);

  // Delete dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // API key visibility
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // API key stats
  const [statsCache, setStatsCache] = useState<Record<number, any>>({});
  const [statsLoading, setStatsLoading] = useState<Record<number, boolean>>({});

  // Full preset creation dialog
  const [presetCreateOpen, setPresetCreateOpen] = useState(false);
  const [presetFormData, setPresetFormData] = useState({
    ...presetDefaultForm,
  });
  const [presetCreateLoading, setPresetCreateLoading] = useState(false);
  // Lookups for preset creation
  const [rateLimits, setRateLimits] = useState<LookupItem[]>([]);
  const [ipAllowlists, setIpAllowlists] = useState<LookupItem[]>([]);
  const [ipBlocklists, setIpBlocklists] = useState<LookupItem[]>([]);
  const [presetProjects, setPresetProjects] = useState<ProjectWithGroups[]>([]);

  useEffect(() => {
    loadPresets();
    loadPresetLookups();
  }, []);

  // Load use cases when filters change
  useEffect(() => {
    loadUseCases(1, pagination.per_page);
  }, [filters]);

  const loadUseCases = useCallback(
    async (page = 1, perPage = 25) => {
      try {
        setLoading(true);
        const params: any = { page, per_page: perPage };
        if (filters.search) params.search = filters.search;
        if (filters.preset_id) params.preset_id = filters.preset_id;

        const res = await api.get("/api-keys", { params });
        setUseCases(res.data.api_keys || res.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      } catch (error) {
        console.error("Failed to load API keys:", error);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  const loadPresets = async () => {
    try {
      const res = await api.get("/presets");
      setPresets(res.data);
    } catch (error) {
      console.error("Failed to load presets:", error);
    }
  };

  const loadPresetLookups = async () => {
    try {
      const [rlRes, alRes, blRes, pRes] = await Promise.all([
        api.get("/rate-limits"),
        api.get("/ip-allowlists"),
        api.get("/ip-blocklists"),
        api.get("/resources"),
      ]);
      setRateLimits(rlRes.data);
      setIpAllowlists(alRes.data);
      setIpBlocklists(blRes.data);
      const projectsWithGroups = await Promise.all(
        pRes.data.map(async (p: any) => {
          try {
            const detail = await api.get(`/resources/${p.id}`);
            return {
              id: p.id,
              name: p.name,
              endpoint_groups: detail.data.endpoint_groups || [],
            };
          } catch {
            return { id: p.id, name: p.name, endpoint_groups: [] };
          }
        }),
      );
      setPresetProjects(projectsWithGroups);
    } catch (error) {
      console.error("Failed to load preset lookups:", error);
    }
  };

  const handlePresetCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetFormData.name.trim()) return;
    setPresetCreateLoading(true);
    try {
      const payload = {
        name: presetFormData.name,
        description: presetFormData.description || null,
        rate_limit_id: presetFormData.rate_limit_id
          ? parseInt(presetFormData.rate_limit_id)
          : null,
        ip_allowlist_id: presetFormData.ip_allowlist_id
          ? parseInt(presetFormData.ip_allowlist_id)
          : null,
        ip_blocklist_id: presetFormData.ip_blocklist_id
          ? parseInt(presetFormData.ip_blocklist_id)
          : null,
        endpoint_group_ids: presetFormData.endpoint_group_ids,
        resource_ids: presetFormData.resource_ids,
        endpoint_group_settings: presetFormData.endpoint_group_settings,
      };
      const res = await api.post("/presets", payload);
      await loadPresets();
      setFormData({ ...formData, preset_id: res.data.id.toString() });
      setPresetCreateOpen(false);
      setPresetFormData({ ...presetDefaultForm });
      toast({
        title: "Preset created",
        description: `"${res.data.name}" created and selected`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to create preset",
      });
    } finally {
      setPresetCreateLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        notes: formData.notes || null,
        preset_id: parseInt(formData.preset_id),
      };

      if (editing) {
        await api.put(`/api-keys/${editing.id}`, payload);
        toast({
          title: "API Key Updated",
          description: `"${formData.name}" has been updated`,
        });
      } else {
        await api.post("/api-keys", payload);
        toast({
          title: "API Key Created",
          description: `"${formData.name}" has been created`,
        });
      }
      setOpen(false);
      setEditing(null);
      setFormData({ name: "", description: "", notes: "", preset_id: "" });
      loadUseCases(pagination.page, pagination.per_page);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || "Failed to save API key");
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const loadStats = async (id: number) => {
    if (statsCache[id]) return;
    setStatsLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await api.get(`/api-keys/${id}/stats`);
      setStatsCache((prev) => ({ ...prev, [id]: res.data }));
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setStatsLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = (id: number) => {
    setDeleteTarget(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || submitting) return;
    setSubmitting(true);
    try {
      await api.delete(`/api-keys/${deleteTarget}`);
      toast({ title: "API Key Deleted", description: "Key case removed" });
      loadUseCases(pagination.page, pagination.per_page);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.error || "Failed to delete API key",
      );
      setErrorDialogOpen(true);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (uc: UseCase) => {
    setEditing(uc);
    const data = {
      name: uc.name,
      description: uc.description || "",
      notes: uc.notes || "",
      preset_id: uc.preset_id?.toString() || "",
    };
    setFormData(data);
    setOriginalFormData(JSON.parse(JSON.stringify(data)));
    setOpen(true);
  };

  const handleOpenPresetDialog = (uc: UseCase) => {
    setPresetDialogUseCase(uc);
    setPresetDialogValue(uc.preset_id?.toString() || "");
    setPresetDialogOpen(true);
  };

  const handlePresetChange = async () => {
    if (!presetDialogUseCase || !presetDialogValue) return;
    setPresetDialogLoading(true);
    try {
      await api.put(`/api-keys/${presetDialogUseCase.id}`, {
        preset_id: parseInt(presetDialogValue),
      });
      toast({
        title: "Preset Updated",
        description: `"${presetDialogUseCase.name}" preset has been updated`,
      });
      setPresetDialogOpen(false);
      setPresetDialogUseCase(null);
      loadUseCases(pagination.page, pagination.per_page);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to update preset",
      });
    } finally {
      setPresetDialogLoading(false);
    }
  };



  const handleCopyKey = async (uc: UseCase) => {
    try {
      await navigator.clipboard.writeText(uc.api_key);
    } catch {
      const el = document.createElement("textarea");
      el.value = uc.api_key;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiedKeyId(uc.id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleKeyVisibility = (id: number) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => {
    if (!key) return "";
    const prefix = key.slice(0, 7);
    return `${prefix}${"•".repeat(Math.min(key.length - 7, 24))}`;
  };

  // Pagination
  const goToPage = (p: number) => {
    if (p < 1 || p > pagination.total_pages) return;
    loadUseCases(p, pagination.per_page);
  };

  const handlePerPageChange = (value: string) => {
    const perPage = parseInt(value, 10);
    loadUseCases(1, perPage);
  };

  const clearFilters = () => {
    setFilters({ search: "", preset_id: "" });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">API Keys</h2>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setEditing(null);
              setOriginalFormData(null);
              setFormData({
                name: "",
                description: "",
                notes: "",
                preset_id: "",
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button data-tour-create="apikey">
              <Plus className="h-4 w-4 mr-2" />
              New API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Create"} API Key</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update API key details"
                  : "Create a new use case with its own API key and preset"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="uc-name">Name *</Label>
                  <Input
                    id="uc-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Mobile App, CI/CD Pipeline"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="uc-description">Description</Label>
                  <Textarea
                    id="uc-description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="What this API key is used for"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor="uc-preset">Preset *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            The preset determines what resources, methods, rate
                            limits, and IP restrictions this API key will have.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.preset_id}
                    onValueChange={(v) => {
                      if (v === "__create_new__") {
                        setPresetCreateOpen(true);
                      } else {
                        setFormData({ ...formData, preset_id: v });
                      }
                    }}
                  >
                    <SelectTrigger id="uc-preset">
                      <SelectValue placeholder="Select a preset…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="__create_new__"
                        className="text-primary font-medium"
                      >
                        ＋ Create New Preset
                      </SelectItem>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name}
                          {p.is_system ? " (System)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="uc-notes">Notes</Label>
                  <Textarea
                    id="uc-notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !formData.name ||
                    !formData.preset_id ||
                    !!(
                      editing &&
                      originalFormData &&
                      formData.name === originalFormData.name &&
                      formData.description === originalFormData.description &&
                      formData.notes === originalFormData.notes &&
                      formData.preset_id === originalFormData.preset_id
                    )
                  }
                >
                  {submitting
                    ? editing
                      ? "Saving…"
                      : "Creating…"
                    : editing
                      ? "Save Changes"
                      : "Create API Key"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Name or description…"
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Preset</Label>
              <Select
                value={filters.preset_id}
                onValueChange={(v) =>
                  setFilters({
                    ...filters,
                    preset_id: v === "all" ? "" : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All presets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All presets</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </div>
            <div className="flex items-end justify-end">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Per page
                </Label>
                <Select
                  value={pagination.per_page.toString()}
                  onValueChange={handlePerPageChange}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            {pagination.total.toLocaleString()} total entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Preset</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <ApiKeysTableSkeleton />
              </Table>
            </div>
          ) : useCases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No API keys match the current filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Preset</TableHead>
                    <TableHead>Created</TableHead>

                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {useCases.map((uc) => (
                    <TableRow key={uc.id}>
                      <TableCell className="font-medium">
                        <div>{uc.name}</div>
                        {(uc.description || uc.notes) && (
                          <details className="cursor-pointer mt-1">
                            <summary className="text-xs text-primary">
                              Details
                            </summary>
                            <div className="mt-1 text-xs text-muted-foreground space-y-1">
                              {uc.description && <p>{uc.description}</p>}
                              {uc.notes && <p className="italic">{uc.notes}</p>}
                            </div>
                          </details>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Key className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded truncate max-w-[200px]">
                            {visibleKeys[uc.id]
                              ? uc.api_key
                              : maskKey(uc.api_key)}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleKeyVisibility(uc.id)}
                          >
                            {visibleKeys[uc.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyKey(uc)}
                          >
                            {copiedKeyId === uc.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {uc.preset_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-accent text-accent-foreground">
                            <SlidersHorizontal className="h-3 w-3" />
                            {uc.preset_name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {uc.created_at
                          ? new Date(uc.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>

                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex justify-end gap-1">
                            <Popover
                              onOpenChange={(open) => {
                                if (open) loadStats(uc.id);
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
                                {statsLoading[uc.id] && !statsCache[uc.id] ? (
                                  <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                  </div>
                                ) : statsCache[uc.id] ? (
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-sm">
                                      Usage Stats
                                    </h4>

                                    {/* Request counts by time range */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="rounded-md bg-muted p-2 text-center">
                                        <p className="text-lg font-bold">
                                          {statsCache[
                                            uc.id
                                          ].requests_24h.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          24h
                                        </p>
                                      </div>
                                      <div className="rounded-md bg-muted p-2 text-center">
                                        <p className="text-lg font-bold">
                                          {statsCache[
                                            uc.id
                                          ].requests_7d.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          7 days
                                        </p>
                                      </div>
                                      <div className="rounded-md bg-muted p-2 text-center">
                                        <p className="text-lg font-bold">
                                          {statsCache[
                                            uc.id
                                          ].requests_30d.toLocaleString()}
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
                                        {statsCache[
                                          uc.id
                                        ].total_requests.toLocaleString()}{" "}
                                        total)
                                      </p>
                                      <div className="flex gap-3 text-xs">
                                        <span className="text-green-600 dark:text-green-400">
                                          ✓{" "}
                                          {statsCache[
                                            uc.id
                                          ].success_count.toLocaleString()}{" "}
                                          ok
                                        </span>
                                        <span className="text-yellow-600 dark:text-yellow-400">
                                          ⚠{" "}
                                          {statsCache[
                                            uc.id
                                          ].client_error_count.toLocaleString()}{" "}
                                          4xx
                                        </span>
                                        <span className="text-red-600 dark:text-red-400">
                                          ✕{" "}
                                          {statsCache[
                                            uc.id
                                          ].server_error_count.toLocaleString()}{" "}
                                          5xx
                                        </span>
                                      </div>
                                      {statsCache[uc.id].avg_response_time_ms >
                                        0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Avg response:{" "}
                                          {
                                            statsCache[uc.id]
                                              .avg_response_time_ms
                                          }
                                          ms
                                        </p>
                                      )}
                                    </div>

                                    {/* Top resources */}
                                    {statsCache[uc.id].top_resources.length >
                                      0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                          Top resources
                                        </p>
                                        <div className="space-y-1">
                                          {statsCache[uc.id].top_resources.map(
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

                                    {/* Quota usage */}
                                    {Object.keys(statsCache[uc.id].usage_counts)
                                      .length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">
                                          Quota usage
                                        </p>
                                        <div className="space-y-1">
                                          {Object.entries(
                                            statsCache[uc.id].usage_counts,
                                          ).map(
                                            ([key, count]: [string, any]) => (
                                              <div
                                                key={key}
                                                className="flex justify-between text-xs"
                                              >
                                                <span className="truncate mr-2 font-mono">
                                                  {key}
                                                </span>
                                                <span className="font-mono text-muted-foreground flex-shrink-0">
                                                  {Number(
                                                    count,
                                                  ).toLocaleString()}
                                                </span>
                                              </div>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {statsCache[uc.id].total_requests === 0 && (
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenPresetDialog(uc)}
                                >
                                  <SlidersHorizontal className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Change preset</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(uc)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit API key</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(uc.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete API key</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => goToPage(1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => goToPage(pagination.total_pages)}
                  disabled={pagination.page >= pagination.total_pages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Preset Dialog */}
      <Dialog
        open={presetDialogOpen}
        onOpenChange={(o) => {
          setPresetDialogOpen(o);
          if (!o) {
            setPresetDialogUseCase(null);
            setPresetDialogValue("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Preset</DialogTitle>
            <DialogDescription>
              {presetDialogUseCase &&
                `Select a preset for "${presetDialogUseCase.name}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Preset</Label>
            <Select
              value={presetDialogValue}
              onValueChange={setPresetDialogValue}
              disabled={presetDialogLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a preset…" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPresetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePresetChange}
              disabled={presetDialogLoading || !presetDialogValue}
            >
              {presetDialogLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This will
              permanently remove the use case and its API key. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Preset Creation Dialog */}
      <Dialog
        open={presetCreateOpen}
        onOpenChange={(o) => {
          setPresetCreateOpen(o);
          if (!o) setPresetFormData({ ...presetDefaultForm });
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Preset</DialogTitle>
            <DialogDescription>
              Define a new access control preset with resources, rate limits,
              and IP restrictions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePresetCreate}>
            <div className="space-y-5 py-4">
              {/* Name */}
              <div>
                <Label htmlFor="new-preset-name">Name *</Label>
                <Input
                  id="new-preset-name"
                  value={presetFormData.name}
                  onChange={(e) =>
                    setPresetFormData({
                      ...presetFormData,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Developer Access"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="new-preset-desc">Description</Label>
                <Textarea
                  id="new-preset-desc"
                  value={presetFormData.description}
                  onChange={(e) =>
                    setPresetFormData({
                      ...presetFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe what this preset grants access to..."
                  rows={2}
                />
              </div>

              {/* Rate Limit */}
              <div>
                <Label>Rate Limit</Label>
                <Select
                  value={presetFormData.rate_limit_id}
                  onValueChange={(v) =>
                    setPresetFormData({
                      ...presetFormData,
                      rate_limit_id: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {rateLimits.map((rl) => (
                      <SelectItem key={rl.id} value={rl.id.toString()}>
                        {rl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IP Allowlist */}
              <div>
                <Label>IP Allowlist</Label>
                <Select
                  value={presetFormData.ip_allowlist_id}
                  onValueChange={(v) =>
                    setPresetFormData({
                      ...presetFormData,
                      ip_allowlist_id: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {ipAllowlists.map((al) => (
                      <SelectItem key={al.id} value={al.id.toString()}>
                        {al.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IP Blocklist */}
              <div>
                <Label>IP Blocklist</Label>
                <Select
                  value={presetFormData.ip_blocklist_id}
                  onValueChange={(v) =>
                    setPresetFormData({
                      ...presetFormData,
                      ip_blocklist_id: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {ipBlocklists.map((bl) => (
                      <SelectItem key={bl.id} value={bl.id.toString()}>
                        {bl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accessible Resources & Endpoint Groups */}
              <div>
                <Label className="mb-2 block">
                  Accessible Resources & Endpoint Groups
                </Label>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Folder className="h-4 w-4" />
                        Configure Resources & Endpoints
                      </span>
                      <span className="flex gap-2 text-xs text-muted-foreground">
                        {presetFormData.resource_ids.length > 0 ? (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            {presetFormData.resource_ids.length} resource
                            {presetFormData.resource_ids.length !== 1
                              ? "s"
                              : ""}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-muted rounded-full">
                            All resources
                          </span>
                        )}
                        {presetFormData.endpoint_group_ids.length > 0 && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            {presetFormData.endpoint_group_ids.length} group
                            {presetFormData.endpoint_group_ids.length !== 1
                              ? "s"
                              : ""}
                          </span>
                        )}
                      </span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-6xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>
                        Accessible Resources & Endpoint Groups
                      </DialogTitle>
                      <DialogDescription>
                        Select resources on the left, then choose specific
                        endpoint groups for each resource on the right.
                      </DialogDescription>
                    </DialogHeader>
                    <ResourceEndpointPicker
                      projects={presetProjects}
                      formData={presetFormData}
                      setFormData={setPresetFormData}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPresetCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!presetFormData.name.trim() || presetCreateLoading}
              >
                {presetCreateLoading ? "Creating…" : "Create Preset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
