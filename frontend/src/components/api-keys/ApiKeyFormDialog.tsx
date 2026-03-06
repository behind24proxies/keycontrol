import { Button } from "@/components/ui/button";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Preset, UseCase } from "@/lib/types";
import type { ApiKeyFormData } from "@/hooks/useApiKeys";
import {
  ResourceEndpointPicker,
  presetDefaultForm,
  type LookupItem,
  type ProjectWithGroups,
} from "@/components/PresetFormComponents";
import { Plus, HelpCircle, Folder, Zap, Timer } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

interface ApiKeyFormDialogProps {
  open: boolean;
  setOpen: (o: boolean) => void;
  editing: UseCase | null;
  formData: ApiKeyFormData;
  setFormData: React.Dispatch<React.SetStateAction<ApiKeyFormData>>;
  originalFormData: ApiKeyFormData | null;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  presets: Preset[];

  // Inline preset creation
  presetCreateOpen: boolean;
  setPresetCreateOpen: (o: boolean) => void;
  presetFormData: ReturnType<typeof getDefaultPresetForm>;
  setPresetFormData: React.Dispatch<React.SetStateAction<ReturnType<typeof getDefaultPresetForm>>>;
  presetCreateLoading: boolean;
  handlePresetCreate: (e: React.FormEvent) => Promise<void>;

  // Preset creation lookups
  rateLimits: LookupItem[];
  ipAllowlists: LookupItem[];
  ipBlocklists: LookupItem[];
  presetProjects: ProjectWithGroups[];
}

function getDefaultPresetForm() {
  return { ...presetDefaultForm };
}

// ── Component ─────────────────────────────────────────────────────────

export function ApiKeyFormDialog({
  open,
  setOpen,
  editing,
  formData,
  setFormData,
  originalFormData,
  submitting,
  handleSubmit,
  resetForm,
  presets,
  presetCreateOpen,
  setPresetCreateOpen,
  presetFormData,
  setPresetFormData,
  presetCreateLoading,
  handlePresetCreate,
  rateLimits,
  ipAllowlists,
  ipBlocklists,
  presetProjects,
}: ApiKeyFormDialogProps) {
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
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

              {/* Per-key quota fields */}
              <div className="border-t pt-4 mt-2 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Optional usage controls for this API key
                </p>
                <div data-tour-apikey-usage-limit>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <Label htmlFor="uc-usage-limit" className="text-sm">Usage Limit</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Maximum total requests this API key can make across all resources. Leave empty for unlimited.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="uc-usage-limit"
                    type="number"
                    min="1"
                    value={formData.usage_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, usage_limit: e.target.value })
                    }
                    placeholder="Unlimited"
                  />
                </div>
                <div data-tour-apikey-lease-duration>
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="h-3.5 w-3.5 text-blue-500" />
                    <Label htmlFor="uc-lease-duration" className="text-sm">Lease Duration (seconds)</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            How long this key stays active after its first request. Leave empty for no expiry.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="uc-lease-duration"
                    type="number"
                    min="1"
                    value={formData.lease_duration_seconds}
                    onChange={(e) =>
                      setFormData({ ...formData, lease_duration_seconds: e.target.value })
                    }
                    placeholder="No expiry"
                  />
                  {formData.lease_duration_seconds && parseInt(formData.lease_duration_seconds) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ≈ {parseInt(formData.lease_duration_seconds) >= 86400
                        ? `${Math.floor(parseInt(formData.lease_duration_seconds) / 86400)}d ${Math.floor((parseInt(formData.lease_duration_seconds) % 86400) / 3600)}h`
                        : parseInt(formData.lease_duration_seconds) >= 3600
                          ? `${Math.floor(parseInt(formData.lease_duration_seconds) / 3600)}h ${Math.floor((parseInt(formData.lease_duration_seconds) % 3600) / 60)}m`
                          : parseInt(formData.lease_duration_seconds) >= 60
                            ? `${Math.floor(parseInt(formData.lease_duration_seconds) / 60)}m ${parseInt(formData.lease_duration_seconds) % 60}s`
                            : `${formData.lease_duration_seconds}s`}
                    </p>
                  )}
                </div>
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
                    formData.preset_id === originalFormData.preset_id &&
                    formData.usage_limit === originalFormData.usage_limit &&
                    formData.lease_duration_seconds === originalFormData.lease_duration_seconds
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
    </>
  );
}
