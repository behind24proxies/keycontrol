import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
// Commented out: only used by limits/lease UI (hidden for now)
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// Commented out: only used by limits/lease UI (hidden for now)
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Folder, Layers } from "lucide-react";
// import { Timer, Zap } from "lucide-react"; // Commented out: limits/lease UI hidden for now

export interface ProjectWithGroups {
  id: number;
  name: string;
  endpoint_groups?: { id: number; name: string; endpoints?: { id: number; method: string; url_pattern: string }[] }[];
}

export interface LookupItem {
  id: number;
  name: string;
}

export const presetDefaultForm = {
  name: "",
  description: "",
  rate_limit_id: "" as string,
  ip_allowlist_id: "" as string,
  ip_blocklist_id: "" as string,
  endpoint_group_ids: [] as number[],
  resource_ids: [] as number[],
  endpoint_group_settings: {} as Record<string, { usage_limit?: number | null; lease_seconds?: number | null }>,
  resource_settings: {} as Record<string, { usage_limit?: number | null; lease_seconds?: number | null }>,
  allowed_methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as string[],
};

export type PresetFormData = typeof presetDefaultForm;

// ── Split-Panel Resource & Endpoint Picker ────────────────────────────
export function ResourceEndpointPicker({
  projects,
  formData,
  setFormData,
}: {
  projects: ProjectWithGroups[];
  formData: PresetFormData;
  setFormData: React.Dispatch<React.SetStateAction<PresetFormData>>;
}) {
  const [focusedProjectId, setFocusedProjectId] = useState<number | null>(
    projects.length > 0 ? projects[0].id : null
  );

  const focusedProject = projects.find((p) => p.id === focusedProjectId) || null;
  const focusedGroups = focusedProject?.endpoint_groups || [];

  const allResourceSelected = projects.length > 0 && projects.every((p) => formData.resource_ids.includes(p.id));
  const allGroupsSelected =
    focusedGroups.length > 0 &&
    focusedGroups.every((g) => formData.endpoint_group_ids.includes(g.id));

  const toggleResource = (id: number) => {
    const isRemoving = formData.resource_ids.includes(id);
    const project = projects.find((p) => p.id === id);
    const projectGroupIds = (project?.endpoint_groups || []).map((g) => g.id);

    if (isRemoving) {
      setFormData({
        ...formData,
        resource_ids: formData.resource_ids.filter((x) => x !== id),
        endpoint_group_ids: formData.endpoint_group_ids.filter((gid) => !projectGroupIds.includes(gid)),
      });
    } else {
      const newGroupIds = new Set([...formData.endpoint_group_ids, ...projectGroupIds]);
      setFormData({
        ...formData,
        resource_ids: [...formData.resource_ids, id],
        endpoint_group_ids: Array.from(newGroupIds),
      });
    }
  };

  const toggleGroup = (id: number) => {
    const ids = formData.endpoint_group_ids;
    const isRemoving = ids.includes(id);
    const newGroupIds = isRemoving ? ids.filter((x) => x !== id) : [...ids, id];

    const ownerProject = projects.find((p) =>
      (p.endpoint_groups || []).some((g) => g.id === id)
    );

    let newProjectIds = [...formData.resource_ids];

    if (!isRemoving && ownerProject && !newProjectIds.includes(ownerProject.id)) {
      newProjectIds.push(ownerProject.id);
    } else if (isRemoving && ownerProject) {
      const ownerGroups = (ownerProject.endpoint_groups || []).map((g) => g.id);
      const remainingSelected = ownerGroups.filter(
        (gid) => gid !== id && newGroupIds.includes(gid)
      );
      if (remainingSelected.length === 0) {
        newProjectIds = newProjectIds.filter((pid) => pid !== ownerProject.id);
      }
    }

    setFormData({
      ...formData,
      endpoint_group_ids: newGroupIds,
      resource_ids: newProjectIds,
    });
  };

  const selectAllResources = () => {
    const allGroupIds = new Set(formData.endpoint_group_ids);
    projects.forEach((p) =>
      (p.endpoint_groups || []).forEach((g) => allGroupIds.add(g.id))
    );
    setFormData({
      ...formData,
      resource_ids: projects.map((p) => p.id),
      endpoint_group_ids: Array.from(allGroupIds),
    });
  };

  const deselectAllResources = () => {
    setFormData({ ...formData, resource_ids: [], endpoint_group_ids: [] });
  };

  const selectAllGroups = () => {
    if (!focusedGroups.length) return;
    const newIds = new Set(formData.endpoint_group_ids);
    focusedGroups.forEach((g) => newIds.add(g.id));
    setFormData({ ...formData, endpoint_group_ids: Array.from(newIds) });
  };

  const deselectAllGroups = () => {
    if (!focusedGroups.length) return;
    const removeIds = new Set(focusedGroups.map((g) => g.id));
    setFormData({
      ...formData,
      endpoint_group_ids: formData.endpoint_group_ids.filter((id) => !removeIds.has(id)),
    });
  };

  // Commented out: limits/lease UI hidden for now
  // const updateProjectSetting = (projectId: number, key: "usage_limit" | "lease_seconds", value: number | null) => {
  //   const settings = { ...formData.resource_settings };
  //   if (!settings[String(projectId)]) settings[String(projectId)] = {};
  //   settings[String(projectId)][key] = value;
  //   setFormData({ ...formData, resource_settings: settings });
  // };

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No resources available. Create a resource first.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-0 border rounded-lg overflow-hidden" style={{ minHeight: "50vh" }}>
      {/* Left Panel — Resources */}
      <div className="border-r flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resources</span>
          <button
            type="button"
            onClick={allResourceSelected ? deselectAllResources : selectAllResources}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            {allResourceSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
        <div className="overflow-y-auto flex-1" style={{ maxHeight: "45vh" }}>
          {projects.map((p) => (
            <div
              key={p.id}
              data-tour-resource-item={p.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-border/30 text-sm ${
                focusedProjectId === p.id
                  ? "bg-primary/5 border-l-2 border-l-primary"
                  : "hover:bg-muted/30"
              }`}
              onClick={() => setFocusedProjectId(p.id)}
            >
              <Checkbox
                data-tour-resource-checkbox={p.id}
                checked={formData.resource_ids.includes(p.id)}
                onCheckedChange={() => toggleResource(p.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate flex-1">{p.name}</span>

              {/* Commented out: limits/lease UI hidden for now */}
              {/* {formData.resource_ids.includes(p.id) && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-tour-resource-usage-limit={p.id}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1 rounded hover:bg-muted transition-colors ${
                          (formData.resource_settings[String(p.id)]?.usage_limit) ? "text-amber-500" : "text-muted-foreground/50"
                        }`}
                        title="Set usage limit for this resource"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-3" side="right">
                      <Label className="text-xs mb-1.5 block">Max Requests</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        value={formData.resource_settings[String(p.id)]?.usage_limit ?? ""}
                        onChange={(e) =>
                          updateProjectSetting(
                            p.id,
                            "usage_limit",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Leave empty for unlimited</p>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-tour-resource-lease-time={p.id}
                        onClick={(e) => e.stopPropagation()}
                        className={`p-1 rounded hover:bg-muted transition-colors ${
                          (formData.resource_settings[String(p.id)]?.lease_seconds) ? "text-blue-500" : "text-muted-foreground/50"
                        }`}
                        title="Set lease time for this resource"
                      >
                        <Timer className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-3" side="right">
                      <Label className="text-xs mb-1.5 block">Lease Time (seconds)</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="No expiry"
                        value={formData.resource_settings[String(p.id)]?.lease_seconds ?? ""}
                        onChange={(e) =>
                          updateProjectSetting(
                            p.id,
                            "lease_seconds",
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="h-8 text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Leave empty for no expiry</p>
                    </PopoverContent>
                  </Popover>
                </>
              )} */}

              {(p.endpoint_groups || []).length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {(p.endpoint_groups || []).length} group{(p.endpoint_groups || []).length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel — Endpoint Groups */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {focusedProject ? `${focusedProject.name} — Groups` : "Endpoint Groups"}
          </span>
          {focusedGroups.length > 0 && (
            <button
              type="button"
              onClick={allGroupsSelected ? deselectAllGroups : selectAllGroups}
              className="text-[10px] font-medium text-primary hover:underline"
            >
              {allGroupsSelected ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1" style={{ maxHeight: "45vh" }}>
          {!focusedProject ? (
            <div className="flex items-center justify-center h-full py-12 text-muted-foreground text-xs">
              Select a resource to view its endpoint groups
            </div>
          ) : focusedGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full py-12 text-muted-foreground text-xs">
              No endpoint groups for this resource
            </div>
          ) : (
            focusedGroups.map((g) => {
              const endpoints = g.endpoints || [];
              const groupRow = (
                <div
                  key={g.id}
                  data-tour-group-item={g.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors border-b border-border/30 text-sm"
                >
                  <Checkbox
                    checked={formData.endpoint_group_ids.includes(g.id)}
                    onCheckedChange={() => toggleGroup(g.id)}
                  />
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{g.name}</span>
                  {endpoints.length > 0 && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              );

              if (endpoints.length === 0) return groupRow;

              const methodColors: Record<string, string> = {
                GET: 'text-emerald-600',
                POST: 'text-blue-600',
                PUT: 'text-amber-600',
                PATCH: 'text-orange-600',
                DELETE: 'text-red-600',
                HEAD: 'text-purple-600',
              };

              return (
                <TooltipProvider key={g.id} delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {groupRow}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs p-0">
                      <div className="px-3 py-2 border-b bg-muted/40">
                        <p className="text-xs font-semibold">{g.name}</p>
                      </div>
                      <div className="px-3 py-2 space-y-1">
                        {endpoints.slice(0, 10).map((ep) => (
                          <div key={ep.id} className="flex items-center gap-2 font-mono text-[11px]">
                            <span className={`font-bold ${methodColors[ep.method] || 'text-muted-foreground'}`}>
                              {ep.method}
                            </span>
                            <span className="text-muted-foreground truncate">{ep.url_pattern}</span>
                          </div>
                        ))}
                        {endpoints.length > 10 && (
                          <p className="text-[10px] text-muted-foreground">+{endpoints.length - 10} more…</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
