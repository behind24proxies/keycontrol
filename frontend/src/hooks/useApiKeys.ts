import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import type { UseCase, Preset } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import {
  presetDefaultForm,
  type LookupItem,
  type ProjectWithGroups,
} from "@/components/PresetFormComponents";

// ── Form data types ───────────────────────────────────────────────────

export interface ApiKeyFormData {
  name: string;
  description: string;
  notes: string;
  preset_id: string;
  usage_limit: string;
  lease_duration_seconds: string;
}

export const emptyApiKeyForm: ApiKeyFormData = {
  name: "",
  description: "",
  notes: "",
  preset_id: "",
  usage_limit: "",
  lease_duration_seconds: "",
};

export interface PaginationState {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface FilterState {
  search: string;
  preset_id: string;
}

function getDefaultPresetForm() {
  return { ...presetDefaultForm };
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useApiKeys() {
  const { toast } = useToast();
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 0,
  });

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    preset_id: "",
  });

  // Create/edit dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UseCase | null>(null);
  const [formData, setFormData] = useState<ApiKeyFormData>({ ...emptyApiKeyForm });
  const [originalFormData, setOriginalFormData] = useState<ApiKeyFormData | null>(null);

  // Presets lookup
  const [presets, setPresets] = useState<Preset[]>([]);

  // Change preset dialog
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetDialogUseCase, setPresetDialogUseCase] = useState<UseCase | null>(null);
  const [presetDialogValue, setPresetDialogValue] = useState("");
  const [presetDialogLoading, setPresetDialogLoading] = useState(false);

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Key visibility
  const [visibleKeys, setVisibleKeys] = useState<Record<number, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  // Stats
  const [statsCache, setStatsCache] = useState<Record<number, any>>({});
  const [statsLoading, setStatsLoading] = useState<Record<number, boolean>>({});

  // Inline preset creation
  const [presetCreateOpen, setPresetCreateOpen] = useState(false);
  const [presetFormData, setPresetFormData] = useState(getDefaultPresetForm());
  const [presetCreateLoading, setPresetCreateLoading] = useState(false);

  // Preset creation lookups
  const [rateLimits, setRateLimits] = useState<LookupItem[]>([]);
  const [ipAllowlists, setIpAllowlists] = useState<LookupItem[]>([]);
  const [ipBlocklists, setIpBlocklists] = useState<LookupItem[]>([]);
  const [presetProjects, setPresetProjects] = useState<ProjectWithGroups[]>([]);

  // ── Data loading ──────────────────────────────────────────────────

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

  useEffect(() => {
    loadPresets();
    loadPresetLookups();
  }, []);

  useEffect(() => {
    loadUseCases(1, pagination.per_page);
  }, [filters]);

  // ── Handlers ──────────────────────────────────────────────────────

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
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        lease_duration_seconds: formData.lease_duration_seconds
          ? parseInt(formData.lease_duration_seconds)
          : null,
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
      setFormData({ ...emptyApiKeyForm });
      loadUseCases(pagination.page, pagination.per_page);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || "Failed to save API key");
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const loadStats = async (id: number) => {
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
    const data: ApiKeyFormData = {
      name: uc.name,
      description: uc.description || "",
      notes: uc.notes || "",
      preset_id: uc.preset_id?.toString() || "",
      usage_limit: uc.usage_limit?.toString() || "",
      lease_duration_seconds: uc.lease_duration_seconds?.toString() || "",
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

  const resetForm = () => {
    setEditing(null);
    setOriginalFormData(null);
    setFormData({ ...emptyApiKeyForm });
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
      setPresetFormData(getDefaultPresetForm());
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

  return {
    // Core data
    useCases,
    loading,
    pagination,
    presets,

    // Filters
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,

    // CRUD form
    open,
    setOpen,
    editing,
    formData,
    setFormData,
    originalFormData,
    submitting,
    handleSubmit,
    handleEdit,
    resetForm,

    // Delete
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    confirmDelete,

    // Error dialog
    errorDialogOpen,
    setErrorDialogOpen,
    errorMessage,

    // Key visibility & copy
    visibleKeys,
    toggleKeyVisibility,
    copiedKeyId,
    handleCopyKey,
    maskKey,

    // Stats
    statsCache,
    statsLoading,
    loadStats,

    // Preset change dialog
    presetDialogOpen,
    setPresetDialogOpen,
    presetDialogUseCase,
    setPresetDialogUseCase,
    presetDialogValue,
    setPresetDialogValue,
    presetDialogLoading,
    handleOpenPresetDialog,
    handlePresetChange,

    // Inline preset creation
    presetCreateOpen,
    setPresetCreateOpen,
    presetFormData,
    setPresetFormData,
    presetCreateLoading,
    handlePresetCreate,

    // Preset creation lookups
    rateLimits,
    ipAllowlists,
    ipBlocklists,
    presetProjects,

    // Pagination
    goToPage,
    handlePerPageChange,

    // Toast
    toast,
  };
}
