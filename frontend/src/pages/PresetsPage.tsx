import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
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

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceEndpointPicker, presetDefaultForm, type LookupItem, type ProjectWithGroups } from "@/components/PresetFormComponents";
import api from "@/lib/api";
import { formatRuleSummary, getBackendUrl } from "@/lib/formatters";
import type { Preset, RateLimitWithRules, ApiKeyRow } from "@/lib/types";
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Check,
  Users,
  Folder,
  Shield,
  Gauge,
  Layers,
  SlidersHorizontal,
  Unlock,
  Search,
  ChevronLeft,
  ChevronRight,
  Lock,
  Eye,
  ExternalLink,
} from "lucide-react";

function PresetsPageSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}



const defaultForm = { ...presetDefaultForm };

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Preset | null>(null);
  const [formData, setFormData] = useState({ ...defaultForm });
  const [originalFormData, setOriginalFormData] = useState<typeof defaultForm | null>(null);

  // Simple delete confirmation (before reassign logic)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<Preset | null>(null);

  // Lookups
  const [rateLimits, setRateLimits] = useState<RateLimitWithRules[]>([]);
  const [ipAllowlists, setIpAllowlists] = useState<LookupItem[]>([]);
  const [ipBlocklists, setIpBlocklists] = useState<LookupItem[]>([]);
  const [projects, setProjects] = useState<ProjectWithGroups[]>([]);

  // View Access modal
  const [accessModalPreset, setAccessModalPreset] = useState<Preset | null>(null);
  // API Keys modal
  const [apiKeysModalPreset, setApiKeysModalPreset] = useState<Preset | null>(null);
  const [apiKeysData, setApiKeysData] = useState<ApiKeyRow[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [deleteApiKeyCount, setDeleteApiKeyCount] = useState(0);
  const [reassignPresetId, setReassignPresetId] = useState<string>("");
  const [reassignSearch, setReassignSearch] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Batch update state
  const [batchStep, setBatchStep] = useState<0 | 1 | 2 | 3>(0);
  const [batchOperation, setBatchOperation] = useState<"add" | "remove">("add");
  const [batchFormData, setBatchFormData] = useState({ ...defaultForm });
  const [batchSelectedPresetIds, setBatchSelectedPresetIds] = useState<number[]>([]);
  const [batchPresetSearch, setBatchPresetSearch] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);

  // Search & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadPresets();
    loadLookups();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/presets");
      setPresets(res.data);
    } catch (error) {
      console.error("Failed to load presets:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async () => {
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
      // Load endpoint groups for each project
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
        })
      );
      setProjects(projectsWithGroups);
    } catch (error) {
      console.error("Failed to load lookups:", error);
    }
  };

  const resetForm = () => {
    setFormData({ ...defaultForm });
    setOriginalFormData(null);
    setEditing(null);
  };

  const hasChanges = (): boolean => {
    if (!originalFormData) return true; // New preset always has changes
    return (
      formData.name !== originalFormData.name ||
      formData.description !== originalFormData.description ||
      formData.rate_limit_id !== originalFormData.rate_limit_id ||
      formData.ip_allowlist_id !== originalFormData.ip_allowlist_id ||
      formData.ip_blocklist_id !== originalFormData.ip_blocklist_id ||
      JSON.stringify(formData.endpoint_group_ids) !== JSON.stringify(originalFormData.endpoint_group_ids) ||
      JSON.stringify(formData.resource_ids) !== JSON.stringify(originalFormData.resource_ids) ||
      JSON.stringify(formData.endpoint_group_settings) !== JSON.stringify(originalFormData.endpoint_group_settings) ||
      JSON.stringify(formData.resource_settings) !== JSON.stringify(originalFormData.resource_settings) ||
      JSON.stringify(formData.allowed_methods?.slice().sort()) !== JSON.stringify(originalFormData.allowed_methods?.slice().sort())
    );
  };

  const handleEdit = (preset: Preset) => {
    setEditing(preset);
    // Build endpoint_group_settings from preset's endpoint groups
    const settings: Record<string, { usage_limit?: number | null; lease_seconds?: number | null }> = {};
    preset.endpoint_groups.forEach((eg) => {
      if (eg.usage_limit || eg.lease_seconds) {
        settings[String(eg.id)] = {
          usage_limit: eg.usage_limit,
          lease_seconds: eg.lease_seconds,
        };
      }
    });
    // Build resource_settings from preset's projects
    const projectSettings: Record<string, { usage_limit?: number | null; lease_seconds?: number | null }> = {};
    preset.resources.forEach((p: any) => {
      if (p.usage_limit || p.lease_seconds) {
        projectSettings[String(p.id)] = {
          usage_limit: p.usage_limit,
          lease_seconds: p.lease_seconds,
        };
      }
    });
    const data = {
      name: preset.name,
      description: preset.description || "",
      rate_limit_id: preset.rate_limit_id?.toString() || "",
      ip_allowlist_id: preset.ip_allowlist_id?.toString() || "",
      ip_blocklist_id: preset.ip_blocklist_id?.toString() || "",
      endpoint_group_ids: preset.endpoint_groups.map((eg) => eg.id),
      resource_ids: preset.resources.map((p) => p.id),
      endpoint_group_settings: settings,
      resource_settings: projectSettings,
      allowed_methods: preset.allowed_methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
    };
    setFormData(data);
    setOriginalFormData(JSON.parse(JSON.stringify(data)));
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        rate_limit_id: formData.rate_limit_id
          ? parseInt(formData.rate_limit_id)
          : null,
        ip_allowlist_id: formData.ip_allowlist_id
          ? parseInt(formData.ip_allowlist_id)
          : null,
        ip_blocklist_id: formData.ip_blocklist_id
          ? parseInt(formData.ip_blocklist_id)
          : null,
        endpoint_group_ids: formData.endpoint_group_ids,
        resource_ids: formData.resource_ids,
        endpoint_group_settings: formData.endpoint_group_settings,
        resource_settings: formData.resource_settings,
        allowed_methods: formData.allowed_methods,
      };

      if (editing) {
        await api.put(`/presets/${editing.id}`, payload);
      } else {
        await api.post("/presets", payload);
      }
      setOpen(false);
      resetForm();
      loadPresets();
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.error || "Failed to save preset"
      );
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (preset: Preset) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/presets/${preset.id}/duplicate`);
      loadPresets();
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.error || "Failed to duplicate preset"
      );
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1: show simple confirmation dialog
  const handleDeleteConfirm = (preset: Preset) => {
    setConfirmDeleteTarget(preset);
    setConfirmDeleteOpen(true);
  };

  // Step 2: after user confirms, attempt the actual delete
  const handleDelete = async (preset: Preset) => {
    setConfirmDeleteOpen(false);
    setConfirmDeleteTarget(null);
    setDeleteTarget(preset);
    setDeleteApiKeyCount(0);
    setReassignPresetId("");
    setReassignSearch("");
    setDeleteLoading(true);

    try {
      // Try deleting directly — if no entities, it succeeds immediately
      await api.delete(`/presets/${preset.id}`);
      loadPresets();
      setDeleteTarget(null);
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Entities are assigned — show reassignment dialog
        setDeleteApiKeyCount(error.response.data.api_key_count || 0);
        setDeleteDialogOpen(true);
      } else {
        setErrorMessage(
          error.response?.data?.error || "Failed to delete preset"
        );
        setDeleteTarget(null);
        setErrorDialogOpen(true);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const confirmDeleteWithReassign = async () => {
    if (!deleteTarget || !reassignPresetId) return;
    setDeleteLoading(true);
    try {
      await api.delete(
        `/presets/${deleteTarget.id}?reassign_preset_id=${reassignPresetId}`
      );
      loadPresets();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setReassignPresetId("");
      setReassignSearch("");
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.error || "Failed to delete preset"
      );
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setErrorDialogOpen(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredReassignPresets = presets.filter(
    (p) =>
      p.id !== deleteTarget?.id &&
      p.name.toLowerCase().includes(reassignSearch.toLowerCase())
  );

  // Batch update handlers
  const resetBatchState = () => {
    setBatchStep(0);
    setBatchFormData({ ...defaultForm });
    setBatchSelectedPresetIds([]);
    setBatchPresetSearch("");
    setBatchOperation("add");
  };

  const handleBatchUpdate = async () => {
    if (batchLoading) return; // guard against double-click
    setBatchLoading(true);
    try {
      await api.post("/presets/batch-update", {
        preset_ids: batchSelectedPresetIds,
        resource_ids: batchFormData.resource_ids,
        endpoint_group_ids: batchFormData.endpoint_group_ids,
        endpoint_group_settings: batchFormData.endpoint_group_settings,
        operation: batchOperation,
      });
      resetBatchState();
      loadPresets();
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.error || "Failed to batch update presets"
      );
      resetBatchState();
      setErrorDialogOpen(true);
    } finally {
      setBatchLoading(false);
    }
  };

  // Filtered presets for batch step-2 selector (excluding system presets)
  const batchFilteredPresets = presets.filter((p) =>
    !p.is_system && p.name.toLowerCase().includes(batchPresetSearch.toLowerCase())
  );
  const batchAllSelected =
    batchFilteredPresets.length > 0 &&
    batchFilteredPresets.every((p) => batchSelectedPresetIds.includes(p.id));

  // Search & pagination computed values
  const filteredPresets = presets.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredPresets.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPresets = filteredPresets.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );



  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Presets</h2>
          <p className="text-muted-foreground mt-1">
            Manage access control presets that define permissions, rate limits,
            and resource access for API keys.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBatchStep(1)} disabled={presets.length === 0}>
            <Layers className="h-4 w-4 mr-2" />
            Batch Update
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button data-tour-create="preset">
                <Plus className="h-4 w-4 mr-2" />
                New Preset
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit" : "Create"} Preset
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update the preset configuration."
                  : "Define a new access control preset."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 py-4">
                {/* Name */}
                <div>
                  <Label htmlFor="preset-name">Name *</Label>
                  <Input
                    id="preset-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g. Developer Access"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="preset-desc">Description</Label>
                  <Textarea
                    id="preset-desc"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe what this preset grants access to..."
                    rows={2}
                  />
                </div>

                {/* Rate Limit */}
                <div>
                  <Label>Rate Limit</Label>
                  <Select
                    value={formData.rate_limit_id}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
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
                          <span className="flex items-center gap-2">
                            {rl.name}
                            {rl.rules && rl.rules.length > 0 && (
                              <span className="text-muted-foreground text-xs">
                                ({formatRuleSummary(rl.rules)})
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* IP Allowlist */}
                <div>
                  <Label>IP Allowlist</Label>
                  <Select
                    value={formData.ip_allowlist_id}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
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
                    value={formData.ip_blocklist_id}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
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
                  <Label className="mb-2 block">Allowed Methods</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((method) => {
                      const isSelected = formData.allowed_methods?.includes(method);
                      const colorMap: Record<string, string> = {
                        GET: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25',
                        POST: 'bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/25',
                        PUT: 'bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25',
                        PATCH: 'bg-orange-500/15 text-orange-600 border-orange-500/30 hover:bg-orange-500/25',
                        DELETE: 'bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/25',
                        HEAD: 'bg-purple-500/15 text-purple-600 border-purple-500/30 hover:bg-purple-500/25',
                      };
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            const methods = formData.allowed_methods || [];
                            if (isSelected) {
                              // Don't allow deselecting the last method
                              if (methods.length <= 1) return;
                              setFormData({ ...formData, allowed_methods: methods.filter(m => m !== method) });
                            } else {
                              setFormData({ ...formData, allowed_methods: [...methods, method] });
                            }
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                            isSelected
                              ? colorMap[method]
                              : 'bg-muted/30 text-muted-foreground/50 border-border/50 hover:bg-muted/50'
                          }`}
                        >
                          {method}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Select HTTP methods this preset allows. At least one is required.</p>
                </div>

                {/* Accessible Resources & Endpoint Groups */}
                <div>
                  <Label className="mb-2 block">Accessible Resources & Endpoint Groups <span className="text-destructive">*</span></Label>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" type="button" data-tour-configure-resources className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <Folder className="h-4 w-4" />
                          Configure Resources & Endpoints
                        </span>
                        <span className="flex gap-2 text-xs text-muted-foreground">
                          {formData.resource_ids.length > 0 ? (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                              {formData.resource_ids.length} resource{formData.resource_ids.length !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded-full">None selected</span>
                          )}
                          {formData.endpoint_group_ids.length > 0 && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                              {formData.endpoint_group_ids.length} group{formData.endpoint_group_ids.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-6xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Accessible Resources & Endpoint Groups</DialogTitle>
                        <DialogDescription>
                          Select resources on the left, then choose specific endpoint groups for each resource on the right.
                        </DialogDescription>
                      </DialogHeader>
                      <ResourceEndpointPicker
                        projects={projects}
                        formData={formData}
                        setFormData={setFormData}
                      />
                      <div className="flex justify-end pt-3 border-t">
                        <DialogClose asChild>
                          <Button variant="default" size="sm" className="px-5">
                            Done
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting || !formData.name.trim() || formData.resource_ids.length === 0 || (editing ? !hasChanges() : false)}>
                  {submitting ? (editing ? 'Updating…' : 'Creating…') : (editing ? "Update" : "Create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      {!loading && presets.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search presets…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 max-w-sm"
          />
        </div>
      )}

      {/* Empty State */}
      {loading ? (
        <PresetsPageSkeleton />
      ) : !loading && presets.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <SlidersHorizontal className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Access Control Presets</CardTitle>
              <CardDescription>
                Create presets to define reusable permission bundles. Assign them
                to users or use cases for consistent access control.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Fine-grained Permissions</CardTitle>
              <CardDescription>
                Control HTTP methods, rate limits, IP restrictions, endpoint
                groups, and resource access — all in one place.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preset Cards */}
      {!loading && presets.length > 0 && (
        <div className="grid gap-4">
          {paginatedPresets.map((preset) => {
            return (
              <Card
                key={preset.id}
                data-preset-name={preset.name}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {preset.is_system ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {preset.name}
                        </CardTitle>
                        {preset.description && (
                          <CardDescription className="mt-1">
                            {preset.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={preset.is_system}
                                onClick={() => handleEdit(preset)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {preset.is_system ? "System presets cannot be modified" : "Edit preset"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={preset.is_system}
                                onClick={() => handleDuplicate(preset)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {preset.is_system ? "System presets cannot be duplicated" : "Duplicate preset"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={preset.is_system}
                                onClick={() => handleDeleteConfirm(preset)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {preset.is_system ? "System presets cannot be deleted" : "Delete preset"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    {/* Usage & Resources */}
                    <div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span className="font-medium text-xs uppercase tracking-wide">
                          Usage
                        </span>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <p className="flex items-center gap-1">
                          {preset.api_key_count} API key
                          {preset.api_key_count !== 1 ? "s" : ""}
                          {preset.api_key_count > 0 && (
                            <button
                              onClick={() => {
                                setApiKeysLoading(true);
                                setApiKeysModalPreset(preset);
                                api.get(`/api-keys?preset_id=${preset.id}`).then(res => {
                                setApiKeysData(res.data.api_keys || []);
                                  setApiKeysLoading(false);
                                }).catch(() => setApiKeysLoading(false));
                              }}
                              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                          )}
                        </p>
                        <p className="flex items-center gap-1">
                          {preset.resources.length} resource
                          {preset.resources.length !== 1 ? "s" : ""}
                          {preset.resources.length > 0 && (
                            <>
                              <span className="text-muted-foreground">
                                ({preset.resources.map(p => p.name).join(', ')})
                              </span>
                              <button
                                onClick={() => setAccessModalPreset(preset)}
                                className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                data-access-btn={preset.name}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Rate Limit & IP */}
                    <div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Gauge className="h-3.5 w-3.5" />
                        <span className="font-medium text-xs uppercase tracking-wide">
                          Restrictions
                        </span>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="cursor-default">
                                Rate Limit:{" "}
                                <span className="text-foreground">
                                  {preset.rate_limit_name || "None"}
                                </span>
                              </p>
                            </TooltipTrigger>
                            {preset.rate_limit_rules && preset.rate_limit_rules.length > 0 && (
                              <TooltipContent>
                                <p>{formatRuleSummary(preset.rate_limit_rules)}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                        <p>
                          Allowlist:{" "}
                          <span className="text-foreground">
                            {preset.ip_allowlist_name || "None"}
                          </span>
                        </p>
                        <p>
                          Blocklist:{" "}
                          <span className="text-foreground">
                            {preset.ip_blocklist_name || "None"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Methods */}
                    <div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        <span className="font-medium text-xs uppercase tracking-wide">
                          Methods
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(preset.allowed_methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']).map((m) => {
                          const colorMap: Record<string, string> = {
                            GET: 'bg-emerald-500/15 text-emerald-600',
                            POST: 'bg-blue-500/15 text-blue-600',
                            PUT: 'bg-amber-500/15 text-amber-600',
                            PATCH: 'bg-orange-500/15 text-orange-600',
                            DELETE: 'bg-red-500/15 text-red-600',
                            HEAD: 'bg-purple-500/15 text-purple-600',
                          };
                          return (
                            <span key={m} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorMap[m] || 'bg-muted text-muted-foreground'}`}>
                              {m}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── View Access Modal ──────────────────────────────────────────── */}
      <Dialog open={accessModalPreset !== null} onOpenChange={(o) => !o && setAccessModalPreset(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Accessible Resources — {accessModalPreset?.name}</DialogTitle>
            <DialogDescription>Resources and endpoint groups available through this preset.</DialogDescription>
          </DialogHeader>
          {accessModalPreset && (
            <div className="space-y-4 py-2">
              {accessModalPreset.resources.length === 0 ? (
                <p className="text-sm text-muted-foreground">No resources assigned to this preset.</p>
              ) : (
                accessModalPreset.resources.map((project) => {
                  const groups = accessModalPreset.endpoint_groups.filter(g => g.resource_id === project.id);
                  const serverBase = getBackendUrl();
                  return (
                    <div key={project.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{project.name}</span>
                        {project.unique_path && (
                          <span className="text-xs text-muted-foreground font-mono">/{project.unique_path}</span>
                        )}
                      </div>
                      {groups.length > 0 ? (
                        groups.map((group) => (
                          <div key={group.id} className="ml-6 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">{group.name}</p>
                            {group.endpoints && group.endpoints.length > 0 ? (
                              group.endpoints.map((ep) => {
                                const fullUrl = `${serverBase}/${project.unique_path}${ep.url_pattern.startsWith('/') ? '' : '/'}${ep.url_pattern}`;
                                const colorMap: Record<string, string> = {
                                  GET: 'bg-emerald-500/15 text-emerald-600',
                                  POST: 'bg-blue-500/15 text-blue-600',
                                  PUT: 'bg-amber-500/15 text-amber-600',
                                  PATCH: 'bg-orange-500/15 text-orange-600',
                                  DELETE: 'bg-red-500/15 text-red-600',
                                  HEAD: 'bg-purple-500/15 text-purple-600',
                                };
                                return (
                                  <div key={ep.id} className="flex items-center gap-2 py-0.5 group">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${colorMap[ep.method] || 'bg-muted text-muted-foreground'}`}>
                                      {ep.method}
                                    </span>
                                    <span className="text-xs font-mono text-muted-foreground truncate flex-1">
                                      {ep.url_pattern}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                      data-copy-url-btn
                                      onClick={() => {
                                        navigator.clipboard.writeText(fullUrl);
                                      }}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-muted-foreground ml-2">No endpoints</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground ml-6">Full resource access (no endpoint group restrictions)</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── API Keys Modal ─────────────────────────────────────────────── */}
      <Dialog open={apiKeysModalPreset !== null} onOpenChange={(o) => { if (!o) { setApiKeysModalPreset(null); setApiKeysData([]); setCopiedKeyId(null); } }}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>API Keys — {apiKeysModalPreset?.name}</DialogTitle>
            <DialogDescription>Keys using this preset ({apiKeysModalPreset?.api_key_count || 0} total).</DialogDescription>
          </DialogHeader>
          {apiKeysLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : apiKeysData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No API keys found.</p>
          ) : (
            <div className="space-y-2 py-2">
              {apiKeysData.map((key) => (
                <div key={key.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{key.name}</p>
                    {key.description && (
                      <p className="text-xs text-muted-foreground truncate">{key.description}</p>
                    )}
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {key.api_key.slice(0, 16)}••••••••
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 ml-2"
                    onClick={() => {
                      navigator.clipboard.writeText(key.api_key);
                      setCopiedKeyId(key.id);
                      setTimeout(() => setCopiedKeyId(null), 2000);
                    }}
                  >
                    {copiedKeyId === key.id ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      {!loading && filteredPresets.length > itemsPerPage && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, filteredPresets.length)} of {filteredPresets.length} presets
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {safePage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Delete & Reassign Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteDialogOpen(false);
            setDeleteTarget(null);
            setReassignPresetId("");
            setReassignSearch("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"</DialogTitle>
            <DialogDescription>
              This preset has{" "}
              <strong>{deleteApiKeyCount} API key{deleteApiKeyCount !== 1 ? "s" : ""}</strong>
              {" "}assigned. Choose another preset to reassign them to before deleting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reassign to</Label>
            <div className="border rounded-md shadow-sm">
              <div className="relative border-b px-3 py-2">
                <Input
                  placeholder="Search presets…"
                  value={reassignSearch}
                  onChange={(e) => setReassignSearch(e.target.value)}
                  className="h-8 border-0 shadow-none focus-visible:ring-0 px-0 pl-7"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto p-1 bg-muted/20">
                {filteredReassignPresets.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">
                    No presets found
                  </p>
                ) : (
                  filteredReassignPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between rounded-sm transition-colors ${
                        reassignPresetId === p.id.toString()
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => setReassignPresetId(p.id.toString())}
                    >
                      <span className="truncate">{p.name}</span>
                      {reassignPresetId === p.id.toString() && (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteTarget(null);
                setReassignPresetId("");
                setReassignSearch("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reassignPresetId || deleteLoading}
              onClick={confirmDeleteWithReassign}
            >
              {deleteLoading ? "Deleting…" : "Reassign & Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Update — Step 1: Resource & Endpoint Picker */}
      <Dialog
        open={batchStep === 1}
        onOpenChange={(o) => {
          if (!o) resetBatchState();
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Batch Update — Select Resources & Endpoints</DialogTitle>
            <DialogDescription>
              Choose the resources and endpoint groups you want to {batchOperation === "remove" ? "remove from" : "add to"} multiple presets.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 pb-2">
            <Label className="text-sm font-medium whitespace-nowrap">Operation:</Label>
            <Select value={batchOperation} onValueChange={(v) => setBatchOperation(v as "add" | "remove")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add</SelectItem>
                <SelectItem value="remove">Remove</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ResourceEndpointPicker
            projects={projects}
            formData={batchFormData}
            setFormData={setBatchFormData}
          />
          <DialogFooter>
            <Button variant="outline" onClick={resetBatchState}>
              Cancel
            </Button>
            <Button
              disabled={
                batchFormData.resource_ids.length === 0 &&
                batchFormData.endpoint_group_ids.length === 0
              }
              onClick={() => setBatchStep(2)}
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Update — Step 2: Preset Selector */}
      <Dialog
        open={batchStep === 2}
        onOpenChange={(o) => {
          if (!o) resetBatchState();
        }}
      >
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Batch Update — Select Presets</DialogTitle>
            <DialogDescription>
              Choose which presets will receive the selected resources and endpoint groups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search presets…"
                value={batchPresetSearch}
                onChange={(e) => setBatchPresetSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                {batchSelectedPresetIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  if (batchAllSelected) {
                    // Only deselect the currently filtered presets
                    const filteredIds = new Set(batchFilteredPresets.map((p) => p.id));
                    setBatchSelectedPresetIds((prev) => prev.filter((id) => !filteredIds.has(id)));
                  } else {
                    // Add all filtered presets to existing selection (avoid dupes)
                    setBatchSelectedPresetIds((prev) => {
                      const existing = new Set(prev);
                      batchFilteredPresets.forEach((p) => existing.add(p.id));
                      return Array.from(existing);
                    });
                  }
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                {batchAllSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {batchFilteredPresets.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No presets found
                </p>
              ) : (
                batchFilteredPresets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors border-b border-border/30 text-sm cursor-pointer"
                    onClick={() => {
                      setBatchSelectedPresetIds((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((id) => id !== p.id)
                          : [...prev, p.id]
                      );
                    }}
                  >
                    <Checkbox
                      checked={batchSelectedPresetIds.includes(p.id)}
                      onCheckedChange={() => {
                        setBatchSelectedPresetIds((prev) =>
                          prev.includes(p.id)
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id]
                        );
                      }}
                    />
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {p.description}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBatchStep(1)}>
              Back
            </Button>
            <Button
              disabled={batchSelectedPresetIds.length === 0}
              onClick={() => setBatchStep(3)}
              variant={batchOperation === "remove" ? "destructive" : "default"}
            >
              {batchOperation === "remove" ? "Remove from Selected Presets" : "Add to Selected Presets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Update — Step 3: Confirmation */}
      <AlertDialog
        open={batchStep === 3}
        onOpenChange={(o) => {
          if (!o) resetBatchState();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {batchOperation === "remove" ? "Confirm Batch Removal" : "Confirm Batch Update"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {batchOperation === "remove" ? "remove" : "add"}{" "}
              <strong>
                {batchFormData.resource_ids.length} resource
                {batchFormData.resource_ids.length !== 1 ? "s" : ""}
              </strong>
              {" "}and{" "}
              <strong>
                {batchFormData.endpoint_group_ids.length} endpoint group
                {batchFormData.endpoint_group_ids.length !== 1 ? "s" : ""}
              </strong>
              {" "}{batchOperation === "remove" ? "from" : "to"}{" "}
              <strong>
                {batchSelectedPresetIds.length} preset
                {batchSelectedPresetIds.length !== 1 ? "s" : ""}
              </strong>
              .{" "}
              {batchOperation === "remove"
                ? "This may affect user quotas."
                : "Existing resource and endpoint group associations will be preserved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={resetBatchState}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Cancel
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleBatchUpdate}
              disabled={batchLoading}
              className={batchOperation === "remove" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {batchLoading ? (batchOperation === "remove" ? "Removing…" : "Updating…") : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={(o) => {
        if (!o) {
          setConfirmDeleteOpen(false);
          setConfirmDeleteTarget(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{confirmDeleteTarget?.name}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteTarget && handleDelete(confirmDeleteTarget)}
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
    </div>
  );
}
