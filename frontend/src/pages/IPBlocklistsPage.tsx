import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { validateIP } from '@/lib/formatters';
import type { IPList, IPListFormData, AssociatedPreset } from '@/lib/types';
import { Plus, Edit, Trash2, HelpCircle, Shield, Ban, AlertTriangle, Lock } from 'lucide-react';

function IPListSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <Skeleton className="h-5 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function IPBlocklistsPage() {
  const [blocklists, setBlocklists] = useState<IPList[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IPList | null>(null);
  const [formData, setFormData] = useState<IPListFormData>({
    name: '',
    ips: '',
    response_code: 403,
    response_body: '{"error": "IP blocked"}',
    response_type: 'json',
  });
  const [ipErrors, setIpErrors] = useState<string[]>([]);
  const [originalFormData, setOriginalFormData] = useState<IPListFormData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAssociatedPresets, setDeleteAssociatedPresets] = useState<AssociatedPreset[]>([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadBlocklists();
  }, []);

  const loadBlocklists = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ip-blocklists');
      setBlocklists(res.data);
    } catch (error) {
      console.error('Failed to load blocklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = (): boolean => {
    if (!originalFormData) return true;
    return (
      formData.name !== originalFormData.name ||
      formData.ips !== originalFormData.ips ||
      formData.response_body !== originalFormData.response_body
    );
  };

  const validateIPs = (ips: string): string[] => {
    const errors: string[] = [];
    const ipList = ips.split('\n').map(ip => ip.trim()).filter(ip => ip);
    
    if (ipList.length === 0) {
      errors.push('At least one IP address or pattern is required');
      return errors;
    }
    
    ipList.forEach((ip, index) => {
      const validation = validateIP(ip);
      if (!validation.valid) {
        errors.push(`Line ${index + 1}: "${ip}" - ${validation.error || 'Invalid IP address or pattern'}`);
      }
    });
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    
    // Validate IPs
    const errors = validateIPs(formData.ips);
    if (errors.length > 0) {
      setIpErrors(errors);
      return;
    }
    
    setIpErrors([]);
    setSubmitting(true);
    
    try {
      if (editing) {
        await api.put(`/ip-blocklists/${editing.id}`, formData);
      } else {
        await api.post('/ip-blocklists', formData);
      }
      setOpen(false);
      setEditing(null);
      setFormData({ name: '', ips: '', response_code: 403, response_body: '{"error": "IP blocked"}', response_type: 'json' });
      setIpErrors([]);
      loadBlocklists();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to save blocklist');
      setErrorDialogOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget(id);
    try {
      // Check for associated presets before showing dialog
      const res = await api.get(`/ip-blocklists/${id}/associated-presets`);
      if (res.data.associated_presets && res.data.associated_presets.length > 0) {
        setDeleteAssociatedPresets(res.data.associated_presets);
      } else {
        setDeleteAssociatedPresets([]);
      }
    } catch (error: any) {
      setDeleteAssociatedPresets([]);
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || submitting) return;
    setSubmitting(true);
    try {
      await api.delete(`/ip-blocklists/${deleteTarget}`);
      loadBlocklists();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteAssociatedPresets([]);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.associated_presets) {
        setDeleteAssociatedPresets(error.response.data.associated_presets);
      } else {
        setErrorMessage(error.response?.data?.error || 'Failed to delete blocklist');
        setErrorDialogOpen(true);
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        setDeleteAssociatedPresets([]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (blocklist: IPList) => {
    setEditing(blocklist);
    const data: IPListFormData = {
      name: blocklist.name,
      ips: blocklist.ips,
      response_code: blocklist.response_code,
      response_body: blocklist.response_body,
      response_type: blocklist.response_type || 'json',
    };
    setFormData(data);
    setOriginalFormData(JSON.parse(JSON.stringify(data)));
    setOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">IP Blocklists</h2>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setOriginalFormData(null);
            setFormData({ name: '', ips: '', response_code: 403, response_body: '{"error": "IP blocked"}', response_type: 'json' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Blocklist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Create'} IP Blocklist</DialogTitle>
              <DialogDescription>
                Add IP addresses or patterns to block (one per line, supports * wildcard)
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
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ips">IPs/Patterns (one per line) *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Enter IP addresses or patterns, one per line. Wildcard patterns must have all 4 parts (e.g., 1.*.*.*). 
                            Patterns like 1.* are not allowed - use 1.*.*.* instead. Wildcards must be at the end.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    id="ips"
                    value={formData.ips}
                    onChange={(e) => {
                      setFormData({ ...formData, ips: e.target.value });
                      // Clear errors when user types
                      if (ipErrors.length > 0) {
                        setIpErrors([]);
                      }
                    }}
                    placeholder="192.168.1.*&#10;10.0.0.1&#10;192.168.0.0/16"
                    rows={5}
                    required
                    className={ipErrors.length > 0 ? 'border-destructive' : ''}
                  />
                  {ipErrors.length > 0 && (
                    <div className="mt-2 text-sm text-destructive space-y-1">
                      {ipErrors.map((error, idx) => (
                        <div key={idx}>{error}</div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valid formats: IPv4 (192.168.1.1), wildcard patterns (192.168.*.*.*, 1.*.*.*). Wildcards must be at the end and all 4 parts required.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="response_type">Response Type</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Response type is locked to JSON for security and consistency.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="response_type"
                    value="JSON"
                    disabled
                    className="opacity-60"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="response_code">Response Code</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            HTTP 403 (Forbidden) is the standard code for IP-based access control.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="response_code"
                    type="number"
                    value={403}
                    disabled
                    className="opacity-60"
                  />
                </div>
                <div>
                  <Label htmlFor="response_body">Error Message</Label>
                  <p className="text-xs text-muted-foreground mb-1">JSON body returned when IP is blocked</p>
                  <Textarea
                    id="response_body"
                    value={formData.response_body}
                    onChange={(e) => setFormData({ ...formData, response_body: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting || !formData.name.trim() || !formData.ips.trim() || (editing ? !hasChanges() : false)}>{submitting ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <IPListSkeleton />
      ) : !loading && blocklists.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Protect Your APIs</CardTitle>
              <CardDescription className="mb-4">
                Create IP blocklists to prevent unauthorized access from specific IP addresses or ranges.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Ban className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Block Malicious IPs</CardTitle>
              <CardDescription className="mb-4">
                Quickly block IPs that are attempting to abuse your API or showing suspicious activity patterns.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Wildcard Support</CardTitle>
              <CardDescription className="mb-4">
                Use wildcard patterns (e.g., 192.168.*.*) to block entire IP ranges efficiently.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Per-Preset Configuration</CardTitle>
              <CardDescription className="mb-4">
                Assign blocklists to specific presets for granular control over which endpoints are protected.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {blocklists.map((blocklist) => (
          <Card key={blocklist.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{blocklist.name}</CardTitle>
                  <CardDescription>
                    Response Code: {blocklist.response_code} | Type: {(blocklist.response_type || 'json').toUpperCase()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(blocklist)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit IP blocklist configuration</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(blocklist.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete this IP blocklist</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <strong>Usage:</strong>
                  <div className="mt-1 text-sm">
                    {(blocklist.usage?.preset_count ?? 0) > 0 ? (
                      <div className="space-y-1">
                        <p>
                          Used by <strong>{blocklist.usage!.preset_count}</strong> preset{blocklist.usage!.preset_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Not used by any presets</p>
                    )}
                  </div>
                </div>
                <div>
                  <strong>IPs/Patterns (blocked):</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-sm whitespace-pre-wrap">{blocklist.ips}</pre>
                </div>
                <div>
                  <strong>Response Body:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-sm">{blocklist.response_body}</pre>
                </div>
              </div>
            </CardContent>
          </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setDeleteTarget(null);
          setDeleteAssociatedPresets([]);
        }
      }}>
        <AlertDialogContent className="max-w-2xl" >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Blocklist</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssociatedPresets.length > 0 ? (
                <div className="space-y-4 mt-4">
                  <p className="text-destructive font-medium">
                    Cannot delete: {deleteAssociatedPresets.length} preset(s) are using this IP blocklist.
                  </p>
                  <p className="text-sm">Please remove this blocklist from the following presets first:</p>
                  <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                    {deleteAssociatedPresets.map((preset) => (
                      <div key={preset.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{preset.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>Are you sure you want to delete this IP blocklist? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteAssociatedPresets.length === 0 && (
              <AlertDialogAction onClick={confirmDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{submitting ? 'Deleting…' : 'Delete'}</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
