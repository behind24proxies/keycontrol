import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputGroup } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { getBackendUrl, formatRelativeTime } from '@/lib/formatters';
import type { Resource } from '@/lib/types';
import { Plus, Edit, Trash2, Key, HelpCircle, Folder, Globe, Shield, Zap, Search, ChevronLeft, ChevronRight } from 'lucide-react';

function ProjectsPageSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-72 mb-4" />
            <div className="grid grid-cols-3 gap-4 pt-2 border-t">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-10" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unique_path: '',
    secret_api_key: '',
    external_api_base_url: '',
    description: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // Search & pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;


  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/resources');
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/resources/${editing.id}`, formData);
        toast({
          title: 'Success',
          description: 'Resource updated successfully',
        });
      } else {
        await api.post('/resources', formData);
        toast({
          title: 'Success',
          description: 'Resource created successfully',
        });
      }
      setOpen(false);
      setEditing(null);
      setFormData({ name: '', unique_path: '', secret_api_key: '', external_api_base_url: '', description: '' });
      loadProjects();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save resource',
      });
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/resources/${deleteTarget}`);
        toast({
          title: 'Success',
          description: 'Resource deleted successfully',
        });
      loadProjects();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete resource',
      });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleEdit = (project: Resource) => {
    setEditing(project);
    setFormData({
      name: project.name,
      unique_path: project.unique_path,
      secret_api_key: project.secret_api_key,
      external_api_base_url: project.external_api_base_url || project.external_api_url || '',
      description: project.description || '',
    });
    setOpen(true);
  };


  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Resources</h2>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setFormData({ name: '', unique_path: '', secret_api_key: '', external_api_base_url: '', description: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button data-tour-create="resource">
              <Plus className="h-4 w-4 mr-2" />
              New Resource
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Create'} Resource</DialogTitle>
              <DialogDescription>
                Create a new resource to manage access
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="API description"
                    rows={3}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="unique_path">Unique Path *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            The unique path is used in the API gateway URL. Requests will be forwarded to your external API base URL.
                            This path cannot be changed after resource creation.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <InputGroup prefix={getBackendUrl() + '/'}>
                    <Input
                      id="unique_path"
                      value={formData.unique_path}
                      onChange={(e) => setFormData({ ...formData, unique_path: e.target.value })}
                      disabled={!!editing}
                      required
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                  </InputGroup>
                  {editing && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Unique path cannot be changed after creation
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="secret_api_key">Secret API Key *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            The master API key from your external API service. This key will be used to authenticate 
                            all requests forwarded through the gateway. Keep this secure and never share it.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="secret_api_key"
                    type="password"
                    value={formData.secret_api_key}
                    onChange={(e) => setFormData({ ...formData, secret_api_key: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="external_api_base_url">External API Base URL *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            The base URL of the external API that requests will be forwarded to. 
                            This should be the root URL without any path (e.g., https://api.example.com).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="external_api_base_url"
                    type="url"
                    value={formData.external_api_base_url}
                    onChange={(e) => setFormData({ ...formData, external_api_base_url: e.target.value })}
                    placeholder="https://api.example.com"
                    required
                  />
                  {formData.external_api_base_url && !formData.external_api_base_url.match(/^https?:\/\//) && (
                    <p className="mt-1 text-xs text-destructive">URL must start with http:// or https://</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!formData.name || !formData.unique_path || !formData.secret_api_key || !formData.external_api_base_url}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      {!loading && projects.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 max-w-sm"
          />
        </div>
      )}

      {loading ? (
        <ProjectsPageSkeleton />
      ) : !loading && projects.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Folder className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Create Your First Resource</CardTitle>
              <CardDescription className="mb-4">
                Resources organize your API endpoints and keys. Each resource has its own unique path and external API configuration. Users get <span className="font-semibold text-primary">virtual keys</span> hiding the master key.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Globe className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Route API Requests</CardTitle>
              <CardDescription className="mb-4">
                Forward requests from your gateway to external APIs while managing authentication, rate limits, and access control.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Secure API Access</CardTitle>
              <CardDescription className="mb-4">
                Control who can access your APIs with API keys, IP blocklists, rate limits, and endpoint restrictions.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Zap className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Monitor Usage</CardTitle>
              <CardDescription className="mb-4">
                Track API usage, view request logs, and analyze performance metrics for all your resources in one place.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (() => {
        const filteredProjects = projects.filter(
          (p: any) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
        const totalPages = Math.max(1, Math.ceil(filteredProjects.length / itemsPerPage));
        const safePage = Math.min(currentPage, totalPages);
        const paginatedProjects = filteredProjects.slice(
          (safePage - 1) * itemsPerPage,
          safePage * itemsPerPage
        );
        return (
          <>
        <div className="grid gap-4">
          {paginatedProjects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Path: /{project.unique_path} | Gateway: {getBackendUrl()}/{project.unique_path}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(project)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit resource settings</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(project.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete this resource</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to={`/resources/${project.id}`} data-tour-resource={project.id}>
                          <Button variant="outline" size="sm">
                            <Key className="h-4 w-4 mr-2" />
                            Manage
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Manage endpoints for this resource</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  External API Base URL: {project.external_api_base_url || project.external_api_url}
                </p>
                <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Total Usage</p>
                    <p className="text-xl font-bold">{project.total_usage_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Endpoint Groups</p>
                    <p className="text-xl font-bold">{project.endpoint_groups_count || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Last Used</p>
                    {project.last_used ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-lg font-semibold cursor-help">
                              {formatRelativeTime(project.last_used)}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{new Date(project.last_used).toLocaleString()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <p className="text-lg font-semibold text-muted-foreground">Never</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
        {filteredProjects.length > itemsPerPage && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, filteredProjects.length)} of {filteredProjects.length} resources
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
          </>
        );
      })()}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this resource? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
