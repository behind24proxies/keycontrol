import { useState } from "react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Preset, UseCase } from "@/lib/types";
import type { ApiKeyFormData } from "@/hooks/useApiKeys";
import {
  presetDefaultForm,
  type LookupItem,
  type ProjectWithGroups,
} from "@/components/PresetFormComponents";
import { PresetFormDialog } from "@/components/PresetFormDialog";
import type { RateLimitWithRules } from "@/lib/types";
import { Plus, HelpCircle, ChevronsUpDown, Search, Check } from "lucide-react";

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
  rateLimits: RateLimitWithRules[];
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
  const [presetSearchOpen, setPresetSearchOpen] = useState(false);
  const [presetSearch, setPresetSearch] = useState("");

  const selectedPreset = presets.find((p) => p.id.toString() === formData.preset_id);
  const filteredPresets = presets.filter((p) =>
    p.name.toLowerCase().includes(presetSearch.toLowerCase())
  );
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
                <Label htmlFor="um-name">Name *</Label>
                <Input
                  id="um-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Mobile App, CI/CD Pipeline"
                  required
                />
              </div>
              <div>
                <Label htmlFor="um-description">Description</Label>
                <Textarea
                  id="um-description"
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
                  <Label htmlFor="um-preset">Preset *</Label>
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
                <Popover open={presetSearchOpen} onOpenChange={setPresetSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={presetSearchOpen}
                      className="w-full justify-between font-normal"
                      id="um-preset"
                      type="button"
                    >
                      <span className={selectedPreset ? "" : "text-muted-foreground"}>
                        {selectedPreset
                          ? `${selectedPreset.name}${selectedPreset.is_system ? " (System)" : ""}`
                          : "Select a preset…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <div className="flex items-center border-b px-3 py-2">
                      <Search className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search presets…"
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-primary font-medium hover:bg-accent transition-colors flex items-center gap-2"
                        onClick={() => {
                          setPresetSearchOpen(false);
                          setPresetSearch("");
                          setPresetCreateOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Create New Preset
                      </button>
                      {filteredPresets.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground text-center">No presets found.</p>
                      ) : (
                        filteredPresets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
                            onClick={() => {
                              setFormData({ ...formData, preset_id: p.id.toString() });
                              setPresetSearchOpen(false);
                              setPresetSearch("");
                            }}
                          >
                            <span>
                              {p.name}
                              {p.is_system ? <span className="text-muted-foreground ml-1">(System)</span> : ""}
                            </span>
                            {formData.preset_id === p.id.toString() && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="um-notes">Notes</Label>
                <Textarea
                  id="um-notes"
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
                    <Label htmlFor="um-usage-limit" className="text-sm">Usage Limit</Label>
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
                    id="um-usage-limit"
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
                    <Label htmlFor="um-lease-duration" className="text-sm">Lease Duration (seconds)</Label>
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
                    id="um-lease-duration"
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

      {/* Reusable Preset Creation Dialog */}
      <PresetFormDialog
        open={presetCreateOpen}
        onOpenChange={(o) => {
          setPresetCreateOpen(o);
          if (!o) setPresetFormData({ ...presetDefaultForm });
        }}
        formData={presetFormData}
        setFormData={setPresetFormData}
        onSubmit={handlePresetCreate}
        loading={presetCreateLoading}
        rateLimits={rateLimits}
        ipAllowlists={ipAllowlists}
        ipBlocklists={ipBlocklists}
        projects={presetProjects}
      />
    </>
  );
}
