import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
import api from "@/lib/api";
import { getBackendUrl } from "@/lib/formatters";
import type { Resource, EndpointGroup, Endpoint } from "@/lib/types";
import {
  Plus,
  Edit,
  Trash2,
  PlusCircle,
  HelpCircle,
  ChevronRight,
  MoreVertical,
} from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();

  const projectId = params.id as string;
  const [project, setProject] = useState<Resource | null>(null);
  const [endpointGroups, setEndpointGroups] = useState<EndpointGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EndpointGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: "",
    description: "",
    endpoints: [{ url_pattern: "", method: "GET" }],
  });
  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<{
    groupId: number;
    endpoint: Endpoint | null;
  } | null>(null);
  const [endpointFormData, setEndpointFormData] = useState({
    url_pattern: "",
    method: "GET",
  });
  const [urlPatternError, setUrlPatternError] = useState<string>("");
  const [externalApiUrlError, setExternalApiUrlError] = useState<string>("");

  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<number | null>(
    null,
  );
  const [deleteGroupPresetInfo, setDeleteGroupPresetInfo] = useState<{
    count: number;
    names: string[];
  } | null>(null);
  const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);

  const [openGroupMenuId, setOpenGroupMenuId] = useState<number | null>(null);
  const [deleteEndpointDialogOpen, setDeleteEndpointDialogOpen] =
    useState(false);
  const [deleteEndpointTarget, setDeleteEndpointTarget] = useState<{
    groupId: number;
    endpointId: number;
  } | null>(null);
  const { toast } = useToast();
  const [projectEditDialogOpen, setProjectEditDialogOpen] = useState(false);

  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    secret_api_key: "",
    external_api_base_url: "",
    timeout_seconds: "",
    timeout_response_code: "504",
    timeout_response_body: '{"error": "Request timeout"}',
    timeout_response_type: "json",
  });


  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await api.get(`/resources/${projectId}`);
      setProject(res.data);
      setEndpointGroups(res.data.endpoint_groups || []);
      // Set form data for editing
      setProjectFormData({
        name: res.data.name || "",
        description: res.data.description || "",
        secret_api_key: res.data.secret_api_key || "",
        external_api_base_url:
          res.data.external_api_base_url || res.data.external_api_url || "",
        timeout_seconds: res.data.timeout_seconds?.toString() || "",
        timeout_response_code:
          res.data.timeout_response_code?.toString() || "504",
        timeout_response_body:
          res.data.timeout_response_body || '{"error": "Request timeout"}',
        timeout_response_type: res.data.timeout_response_type || "json",
      });
    } catch (error) {
      console.error("Failed to load project:", error);
    }
  };





  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        // When editing, preserve existing endpoints
        await api.put(`/endpoint-groups/${editingGroup.id}`, {
          name: groupFormData.name,
          description: groupFormData.description,
          endpoints: editingGroup.endpoints || [],
        });
      } else {
        // When creating new, use empty endpoints array (user will add them via the endpoint dialog)
        await api.post(`/resources/${projectId}/endpoint-groups`, {
          name: groupFormData.name,
          description: groupFormData.description,
          endpoints: [],
        });
      }
      setGroupDialogOpen(false);
      setEditingGroup(null);
      setGroupFormData({
        name: "",
        description: "",
        endpoints: [{ url_pattern: "", method: "GET" }],
      });
      toast({
        title: "Success",
        description: editingGroup
          ? "Endpoint group updated successfully"
          : "Endpoint group created successfully",
      });
      loadProject();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Failed to save endpoint group",
      });
    }
  };

  const handleEndpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEndpoint) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No endpoint group selected",
      });
      return;
    }

    // Validate URL pattern: max 1 wildcard
    const wildcardCount = (endpointFormData.url_pattern.match(/\*/g) || [])
      .length;
    if (wildcardCount > 1) {
      setUrlPatternError(
        "URL pattern cannot contain more than one wildcard (*)",
      );
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "URL pattern cannot contain more than one wildcard (*)",
      });
      return;
    }

    // Validate external API base URL: no wildcards
    const baseUrl =
      project?.external_api_base_url || project?.external_api_url || "";
    if (baseUrl.includes("*")) {
      setExternalApiUrlError(
        "External API base URL cannot contain wildcards (*)",
      );
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "External API base URL cannot contain wildcards (*)",
      });
      return;
    }

    setUrlPatternError("");
    setExternalApiUrlError("");

    try {
      const group = endpointGroups.find(
        (g) => g.id === editingEndpoint.groupId,
      );
      if (!group) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Endpoint group not found",
        });
        return;
      }

      const existingEndpoints = group.endpoints || [];
      let updatedEndpoints;

      if (editingEndpoint.endpoint && editingEndpoint.endpoint.id) {
        // Editing existing endpoint
        updatedEndpoints = existingEndpoints.map((ep: any) =>
          ep.id === editingEndpoint.endpoint!.id
            ? { ...endpointFormData, id: ep.id }
            : ep,
        );
      } else {
        // Adding new endpoint
        updatedEndpoints = [...existingEndpoints, endpointFormData];
      }

      await api.put(`/endpoint-groups/${editingEndpoint.groupId}`, {
        name: group.name,
        endpoints: updatedEndpoints,
      });

      setEndpointDialogOpen(false);
      setEditingEndpoint(null);
      setEndpointFormData({ url_pattern: "", method: "GET" });
      setUrlPatternError("");
      toast({
        title: "Success",
        description: editingEndpoint.endpoint
          ? "Endpoint updated successfully"
          : "Endpoint added successfully",
      });
      loadProject();
    } catch (error: any) {
      console.error("Error saving endpoint:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to save endpoint",
      });
    }
  };

  const handleDeleteEndpoint = async (groupId: number, endpointId: number) => {
    setDeleteEndpointTarget({ groupId, endpointId });
    setDeleteEndpointDialogOpen(true);
  };

  const confirmDeleteEndpoint = async () => {
    if (!deleteEndpointTarget) return;

    try {
      const group = endpointGroups.find(
        (g) => g.id === deleteEndpointTarget.groupId,
      );
      if (!group) return;

      const updatedEndpoints = (group.endpoints || []).filter(
        (ep: any) => ep.id !== deleteEndpointTarget.endpointId,
      );

      await api.put(`/endpoint-groups/${deleteEndpointTarget.groupId}`, {
        name: group.name,
        endpoints: updatedEndpoints,
      });

      toast({
        title: "Success",
        description: "Endpoint deleted successfully",
      });
      loadProject();
      setDeleteEndpointDialogOpen(false);
      setDeleteEndpointTarget(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to delete endpoint",
      });
      setDeleteEndpointDialogOpen(false);
      setDeleteEndpointTarget(null);
    }
  };

  const openEndpointDialog = (groupId: number, endpoint?: any) => {
    setEditingEndpoint({ groupId, endpoint: endpoint || null });
    if (endpoint) {
      setEndpointFormData({
        url_pattern: endpoint.url_pattern,
        method: endpoint.method,
      });
    } else {
      setEndpointFormData({ url_pattern: "", method: "GET" });
    }
    setEndpointDialogOpen(true);
  };





  const handleEditGroup = (group: EndpointGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description || "",
      endpoints: group.endpoints || [],
    });
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (id: number) => {
    setDeleteGroupTarget(id);
    setDeleteGroupPresetInfo(null);
    setDeleteGroupLoading(true);
    try {
      // First call without force to check for associated presets
      const res = await api.delete(`/endpoint-groups/${id}`);
      if (res.data.confirm_required) {
        // Presets reference this group — show warning dialog
        setDeleteGroupPresetInfo({
          count: res.data.associated_preset_count,
          names: res.data.associated_presets.map((p: any) => p.name),
        });
        setDeleteGroupDialogOpen(true);
      } else {
        // No presets — already deleted
        loadProject();
        toast({
          title: "Success",
          description: "Endpoint group deleted successfully",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Failed to delete endpoint group",
      });
    } finally {
      setDeleteGroupLoading(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setDeleteGroupLoading(true);
    try {
      await api.delete(
        `/endpoint-groups/${deleteGroupTarget}?force=true`,
      );
      loadProject();
      toast({
        title: "Success",
        description: "Endpoint group deleted successfully",
      });
      setDeleteGroupDialogOpen(false);
      setDeleteGroupTarget(null);
      setDeleteGroupPresetInfo(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Failed to delete endpoint group",
      });
      setDeleteGroupDialogOpen(false);
      setDeleteGroupTarget(null);
      setDeleteGroupPresetInfo(null);
    } finally {
      setDeleteGroupLoading(false);
    }
  };



  const handleProjectEdit = () => {
    setProjectEditDialogOpen(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/resources/${projectId}`, {
        ...projectFormData,
        timeout_seconds: projectFormData.timeout_seconds
          ? parseInt(projectFormData.timeout_seconds)
          : null,
        timeout_response_code: parseInt(projectFormData.timeout_response_code),
      });
      toast({
        title: "Success",
        description: "Resource updated successfully",
      });
      setProjectEditDialogOpen(false);
      loadProject();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Failed to update resource",
      });
    }
  };

  if (!project) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/resources" className="hover:text-foreground transition-colors">
          Resources
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project?.name || "Loading..."}</span>
      </div>

      {/* Project Details Header */}
      {project && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <CardTitle className="text-3xl">{project.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleProjectEdit}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {project.description && (
                    <p className="text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Path:
                      </span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        /{project.unique_path}
                      </code>
                      <span className="text-sm text-muted-foreground">|</span>
                      <span className="text-sm font-medium text-muted-foreground">
                        Gateway:
                      </span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {getBackendUrl()}/{project.unique_path}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        Base URL:
                      </span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {project.external_api_base_url ||
                          project.external_api_url}
                      </code>
                    </div>
                    {project.timeout_seconds && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Timeout:
                        </span>
                        <span className="text-sm">
                          {project.timeout_seconds} seconds
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">

                    <div>
                      <span className="text-xs text-muted-foreground">
                        Endpoint Groups
                      </span>
                      <p className="text-lg font-semibold">
                        {endpointGroups.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Project Edit Dialog */}
      <Dialog
        open={projectEditDialogOpen}
        onOpenChange={(o) => {
          setProjectEditDialogOpen(o);
          if (!o && project) {
            // Reset form data when closing
            setExternalApiUrlError("");
            setProjectFormData({
              name: project.name || "",
              description: project.description || "",
              secret_api_key: project.secret_api_key || "",
              external_api_base_url:
                project.external_api_base_url || project.external_api_url || "",
              timeout_seconds: project.timeout_seconds?.toString() || "",
              timeout_response_code:
                project.timeout_response_code?.toString() || "504",
              timeout_response_body:
                project.timeout_response_body || '{"error": "Request timeout"}',
              timeout_response_type: project.timeout_response_type || "json",
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>
              Update resource settings including name, description, and timeout
              configuration
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProjectSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="project-name">Name *</Label>
                <Input
                  id="project-name"
                  value={projectFormData.name}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      name: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={projectFormData.description}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      description: e.target.value,
                    })
                  }
                   placeholder="Resource description"
                  rows={3}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="project-secret-key">Secret API Key *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          The master API key from your external API service.
                          This key will be used to authenticate all requests
                          forwarded through the gateway.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="project-secret-key"
                  type="password"
                  value={projectFormData.secret_api_key}
                  onChange={(e) =>
                    setProjectFormData({
                      ...projectFormData,
                      secret_api_key: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="project-base-url">
                    External API Base URL *
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          The base URL of the external API that requests will be
                          forwarded to.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="project-base-url"
                  value={projectFormData.external_api_base_url}
                  onChange={(e) => {
                    const value = e.target.value;
                    setProjectFormData({
                      ...projectFormData,
                      external_api_base_url: value,
                    });
                    // Validate: no wildcards in base URL
                    if (value.includes("*")) {
                      setExternalApiUrlError(
                        "External API base URL cannot contain wildcards (*)",
                      );
                    } else {
                      setExternalApiUrlError("");
                    }
                  }}
                  placeholder="https://api.example.com"
                  required
                  className={externalApiUrlError ? "border-destructive" : ""}
                />
                {externalApiUrlError && (
                  <p className="mt-1 text-xs text-destructive">
                    {externalApiUrlError}
                  </p>
                )}
              </div>
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-4">
                  Timeout Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="timeout-seconds">Timeout (seconds)</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Maximum time in seconds to wait for a response
                              from the external API. Leave empty for no timeout.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="timeout-seconds"
                      type="number"
                      min="1"
                      value={projectFormData.timeout_seconds}
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          timeout_seconds: e.target.value,
                        })
                      }
                      placeholder="e.g., 30"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="timeout-response-code">
                        Timeout Response Code
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              HTTP status code to return when a timeout occurs.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="timeout-response-code"
                      type="number"
                      min="100"
                      max="599"
                      value={projectFormData.timeout_response_code}
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          timeout_response_code: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="timeout-response-type">
                        Timeout Response Type
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Content type of the timeout response body.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select
                      value={projectFormData.timeout_response_type}
                      onValueChange={(value) =>
                        setProjectFormData({
                          ...projectFormData,
                          timeout_response_type: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="xml">XML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="timeout-response-body">
                        Timeout Response Body
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Response body to return when a timeout occurs. For
                              JSON, use valid JSON format.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      id="timeout-response-body"
                      value={projectFormData.timeout_response_body}
                      onChange={(e) =>
                        setProjectFormData({
                          ...projectFormData,
                          timeout_response_body: e.target.value,
                        })
                      }
                      placeholder='{"error": "Request timeout"}'
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!projectFormData.name.trim() || !projectFormData.external_api_base_url.trim()}>Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-8">
        {/* Endpoint Groups */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Endpoint Groups</CardTitle>
                <CardDescription>
                  Manage endpoint groups for this resource
                </CardDescription>
              </div>
              <Dialog
                open={groupDialogOpen}
                onOpenChange={(o) => {
                  setGroupDialogOpen(o);
                  if (!o) {
                    setEditingGroup(null);
                    setGroupFormData({
                      name: "",
                      description: "",
                      endpoints: [],
                    });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button data-tour-create="group">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {editingGroup ? "Edit Group" : "New Group"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingGroup ? "Edit" : "Create"} Endpoint Group
                    </DialogTitle>
                    <DialogDescription>
                      Create an endpoint group. You can add endpoints after
                      creating the group.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleGroupSubmit}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          value={groupFormData.name}
                          onChange={(e) =>
                            setGroupFormData({
                              ...groupFormData,
                              name: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={groupFormData.description}
                          onChange={(e) =>
                            setGroupFormData({
                              ...groupFormData,
                              description: e.target.value,
                            })
                          }
                          placeholder="e.g., Endpoints allowed for jr developer"
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={!groupFormData.name.trim()}>Save</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...endpointGroups]
                .sort((a, b) => {
                  const aDate = a.created_at
                    ? new Date(a.created_at).getTime()
                    : 0;
                  const bDate = b.created_at
                    ? new Date(b.created_at).getTime()
                    : 0;
                  return aDate - bDate;
                })
                .map((group, index) => (
                  <Card key={group.id}>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-lg">
                            {index + 1}. {group.name}
                          </CardTitle>
                          {group.description && (
                            <CardDescription className="mt-1">
                              {group.description}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  data-tour-create="endpoint"
                                  onClick={() => openEndpointDialog(group.id)}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Endpoint
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Add a new endpoint URL pattern to this group
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Popover
                            open={openGroupMenuId === group.id}
                            onOpenChange={(open) =>
                              setOpenGroupMenuId(open ? group.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-1" align="end">
                              <div className="flex flex-col">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start w-full"
                                  onClick={() => {
                                    setOpenGroupMenuId(null);
                                    handleEditGroup(group);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-start w-full text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setOpenGroupMenuId(null);
                                    handleDeleteGroup(group.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {group.endpoints && group.endpoints.length > 0 ? (
                          group.endpoints.map((endpoint: any) => (
                            <Card key={endpoint.id} className="p-4">
                              <div className="flex justify-between items-center">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="px-2 py-1 rounded text-xs font-mono text-white"
                                      style={{
                                        backgroundColor:
                                          endpoint.method === "GET"
                                            ? "#10b981"
                                            : endpoint.method === "POST"
                                              ? "#3b82f6"
                                              : endpoint.method === "PUT"
                                                ? "#f59e0b"
                                                : endpoint.method === "PATCH"
                                                  ? "#8b5cf6"
                                                  : endpoint.method === "DELETE"
                                                    ? "#ef4444"
                                                    : "#6b7280",
                                      }}
                                    >
                                      {endpoint.method}
                                    </span>
                                    <span className="font-mono text-sm">
                                      {endpoint.url_pattern}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            openEndpointDialog(
                                              group.id,
                                              endpoint,
                                            )
                                          }
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Edit this endpoint</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() =>
                                            handleDeleteEndpoint(
                                              group.id,
                                              endpoint.id,
                                            )
                                          }
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Delete this endpoint</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </Card>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No endpoints yet. Click "Add Endpoint" to add one.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </CardContent>

          {/* Endpoint Dialog */}
          <Dialog
            open={endpointDialogOpen}
            onOpenChange={(o) => {
              setEndpointDialogOpen(o);
              if (!o) {
                setEditingEndpoint(null);
                setEndpointFormData({ url_pattern: "", method: "GET" });
                setUrlPatternError("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEndpoint?.endpoint ? "Edit" : "Add"} Endpoint
                </DialogTitle>
                <DialogDescription>
                  {project && (
                    <div className="space-y-1">
                      <p>Add endpoint for this base URL:</p>
                      <p className="font-mono text-sm bg-muted p-2 rounded">
                        {project.external_api_base_url ||
                          project.external_api_url}
                      </p>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEndpointSubmit}>
                <div className="space-y-4 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Label>URL Pattern *</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Define URL patterns that match endpoints. Use * as
                              a wildcard to match any segment. For example:
                              /api/*/users matches /api/v1/users, /api/v2/users,
                              etc.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      placeholder="/api/*/users or /api/v1/posts"
                      value={endpointFormData.url_pattern}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEndpointFormData({
                          ...endpointFormData,
                          url_pattern: value,
                        });
                        // Validate: max 1 wildcard
                        const wildcardCount = (value.match(/\*/g) || []).length;
                        if (wildcardCount > 1) {
                          setUrlPatternError(
                            "URL pattern cannot contain more than one wildcard (*)",
                          );
                        } else {
                          setUrlPatternError("");
                        }
                      }}
                      required
                      className={urlPatternError ? "border-destructive" : ""}
                    />
                    {urlPatternError && (
                      <p className="mt-1 text-xs text-destructive">
                        {urlPatternError}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use * for wildcards (e.g., /api/*/users). Note: /* and /*/
                      are different patterns - /* matches any single segment,
                      while /*/ matches any segment followed by a slash. Maximum
                      one wildcard (*) allowed per pattern.
                    </p>
                  </div>
                  <div>
                    <Label>HTTP Method</Label>
                    <Select
                      value={endpointFormData.method}
                      onValueChange={(value) =>
                        setEndpointFormData({
                          ...endpointFormData,
                          method: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {endpointFormData.method && (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    endpointFormData.method === "GET"
                                      ? "#10b981"
                                      : endpointFormData.method === "POST"
                                        ? "#3b82f6"
                                        : endpointFormData.method === "PUT"
                                          ? "#f59e0b"
                                          : endpointFormData.method === "PATCH"
                                            ? "#8b5cf6"
                                            : endpointFormData.method ===
                                                "DELETE"
                                              ? "#ef4444"
                                              : "#6b7280",
                                }}
                              />
                              <span>{endpointFormData.method}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span>GET</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="POST">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>POST</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="PUT">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>PUT</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="PATCH">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span>PATCH</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="DELETE">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span>DELETE</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {project && endpointFormData.url_pattern && (
                    <div className="pt-2 border-t">
                      <Label className="text-sm font-medium">Final URL:</Label>
                      <div className="mt-2 p-3 bg-muted rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                endpointFormData.method === "GET"
                                  ? "#10b981"
                                  : endpointFormData.method === "POST"
                                    ? "#3b82f6"
                                    : endpointFormData.method === "PUT"
                                      ? "#f59e0b"
                                      : endpointFormData.method === "PATCH"
                                        ? "#8b5cf6"
                                        : endpointFormData.method === "DELETE"
                                          ? "#ef4444"
                                          : "#6b7280",
                            }}
                          />
                          <span className="font-semibold text-sm">
                            {endpointFormData.method}
                          </span>
                        </div>
                        <p className="font-mono text-sm break-all">
                          {project.external_api_base_url ||
                            project.external_api_url}
                          {endpointFormData.url_pattern.startsWith("/")
                            ? ""
                            : "/"}
                          {endpointFormData.url_pattern}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!endpointFormData.url_pattern.trim()}>Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Card>

      </div>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog
        open={deleteGroupDialogOpen}
        onOpenChange={(open) => {
          setDeleteGroupDialogOpen(open);
          if (!open) {
            setDeleteGroupTarget(null);
            setDeleteGroupPresetInfo(null);
          }
        }}
      >
        <AlertDialogContent
          className="max-w-2xl"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint Group</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteGroupPresetInfo && deleteGroupPresetInfo.count > 0 ? (
                  <>
                    <p>
                      This endpoint group is currently used by{" "}
                      <strong>
                        {deleteGroupPresetInfo.count} preset{deleteGroupPresetInfo.count !== 1 ? "s" : ""}
                      </strong>
                      :
                    </p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                      {deleteGroupPresetInfo.names.map((name, i) => (
                        <li key={i}>{name}</li>
                      ))}
                    </ul>
                    <p className="text-destructive font-medium">
                      Deleting it will permanently remove it from those presets
                      and may affect user quotas. This cannot be undone.
                    </p>
                  </>
                ) : (
                  <p>
                    Are you sure you want to delete this endpoint group? This action cannot be undone.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              disabled={deleteGroupLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteGroupLoading ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Delete Endpoint Confirmation Dialog */}
      <AlertDialog
        open={deleteEndpointDialogOpen}
        onOpenChange={setDeleteEndpointDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this endpoint? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEndpoint}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
