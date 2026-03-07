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
import { Button } from "@/components/ui/button";
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
  ResourceEndpointPicker,
  type LookupItem,
  type ProjectWithGroups,
  type PresetFormData,
} from "@/components/PresetFormComponents";
import { formatRuleSummary } from "@/lib/formatters";
import type { RateLimitWithRules } from "@/lib/types";
import { Folder } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────

interface PresetFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  formData: PresetFormData;
  setFormData: React.Dispatch<React.SetStateAction<PresetFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  editing?: boolean;
  /** Extra submit-disabled check, e.g. hasChanges() for edit mode on PresetsPage */
  submitDisabledExtra?: boolean;

  // Lookups
  rateLimits: RateLimitWithRules[];
  ipAllowlists: LookupItem[];
  ipBlocklists: LookupItem[];
  projects: ProjectWithGroups[];
}

// ── Component ─────────────────────────────────────────────────────────

export function PresetFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  loading,
  editing = false,
  submitDisabledExtra = false,
  rateLimits,
  ipAllowlists,
  ipBlocklists,
  projects,
}: PresetFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <form onSubmit={onSubmit}>
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

            {/* Allowed Methods */}
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
                      <Button variant="default" size="sm" className="px-5" data-tour-done-resources>
                        Done
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name.trim() || formData.resource_ids.length === 0 || submitDisabledExtra}
            >
              {loading
                ? (editing ? "Updating…" : "Creating…")
                : (editing ? "Update" : "Create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
