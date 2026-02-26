import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { validateIP } from '@/lib/formatters';
import type { IPList, IPListFormData, AssociatedPreset } from '@/lib/types';
import { Plus, Edit, Trash2, HelpCircle, ShieldCheck, Ban, AlertTriangle, Lock } from 'lucide-react';

export default function IPAllowlistsPage() {
  const [allowlists, setAllowlists] = useState<IPList[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IPList | null>(null);
  const [formData, setFormData] = useState<IPListFormData>({
    name: '',
    ips: '',
    response_code: 403,
    response_body: '{"error": "IP not allowed"}',
    response_type: 'json',
  });
  const [ipErrors, setIpErrors] = useState<string[]>([]);
  const [originalFormData, setOriginalFormData] = useState<IPListFormData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAssociatedPresets, setDeleteAssociatedPresets] = useState<AssociatedPreset[]>([]);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadAllowlists();
  }, []);

  const loadAllowlists = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ip-allowlists');
      setAllowlists(res.data);
    } catch (error) {
      console.error('Failed to load allowlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = (): boolean => {
    if (!originalFormData) return true; // New allowlist always has changes
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
    
    // Validate IPs
    const errors = validateIPs(formData.ips);
    if (errors.length > 0) {
      setIpErrors(errors);
      return;
    }
    
    setIpErrors([]);
    
    try {
      if (editing) {
        await api.put(`/ip-allowlists/${editing.id}`, formData);
      } else {
        await api.post('/ip-allowlists', formData);
      }
      setOpen(false);
      setEditing(null);
      setFormData({ name: '', ips: '', response_code: 403, response_body: '{"error": "IP not allowed"}', response_type: 'json' });
      setIpErrors([]);
      loadAllowlists();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to save allowlist');
      setErrorDialogOpen(true);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget(id);
    try {
      // Check for associated presets before showing dialog
      const res = await api.get(`/ip-allowlists/${id}/associated-presets`);
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
    if (!deleteTarget) return;
    try {
      await api.delete(`/ip-allowlists/${deleteTarget}`);
      loadAllowlists();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteAssociatedPresets([]);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.associated_presets) {
        setDeleteAssociatedPresets(error.response.data.associated_presets);
      } else {
        setErrorMessage(error.response?.data?.error || 'Failed to delete allowlist');
        setErrorDialogOpen(true);
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        setDeleteAssociatedPresets([]);
      }
    }
  };

  const handleEdit = (allowlist: IPList) => {
    setEditing(allowlist);
    const data: IPListFormData = {
      name: allowlist.name,
      ips: allowlist.ips,
      response_code: allowlist.response_code,
      response_body: allowlist.response_body,
      response_type: allowlist.response_type || 'json',
    };
    setFormData(data);
    setOriginalFormData(JSON.parse(JSON.stringify(data)));
    setOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">IP Allowlists</h2>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setOriginalFormData(null);
            setFormData({ name: '', ips: '', response_code: 403, response_body: '{"error": "IP not allowed"}', response_type: 'json' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Allowlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Create'} IP Allowlist</DialogTitle>
              <DialogDescription>
                Add IP addresses or patterns to allow (one per line, supports * wildcard)
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
                    Valid formats: IPv4 (192.168.1.1), wildcard patterns (192.168.*.*, 1.*.*.*). Wildcards must be at the end and all 4 parts required.
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
                  <p className="text-xs text-muted-foreground mb-1">JSON body returned when IP is not in the allowlist</p>
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
                <Button type="submit" disabled={!formData.name.trim() || !formData.ips.trim() || (editing ? !hasChanges() : false)}>Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!loading && allowlists.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <ShieldCheck className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Allow Specific IPs</CardTitle>
              <CardDescription className="mb-4">
                Create IP allowlists to restrict access to only specific IP addresses or ranges.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Ban className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Whitelist Trusted IPs</CardTitle>
              <CardDescription className="mb-4">
                Only allow requests from trusted IP addresses that you specify in the allowlist.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Wildcard Support</CardTitle>
              <CardDescription className="mb-4">
                Use wildcard patterns (e.g., 192.168.*.*) to allow entire IP ranges efficiently.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Lock className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Per-Preset Configuration</CardTitle>
              <CardDescription className="mb-4">
                Assign allowlists to specific presets for granular control over which IPs can access your endpoints.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {allowlists.map((allowlist) => (
          <Card key={allowlist.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{allowlist.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(allowlist)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit IP allowlist configuration</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(allowlist.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete this IP allowlist</p>
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
                    {(allowlist.usage?.preset_count ?? 0) > 0 ? (
                      <div className="space-y-1">
                        <p>
                          Used by <strong>{allowlist.usage!.preset_count}</strong> preset{allowlist.usage!.preset_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Not used by any presets</p>
                    )}
                  </div>
                </div>
                <div>
                  <strong>IPs/Patterns (allowed):</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-sm whitespace-pre-wrap">{allowlist.ips}</pre>
                </div>
                <div>
                  <strong>Response Body (if not whitelisted):</strong>
                  <p className="mt-1 text-sm text-muted-foreground mb-1">Response Code: {allowlist.response_code}</p>
                  <pre className="mt-1 p-2 bg-muted rounded text-sm">{allowlist.response_body}</pre>
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
            <AlertDialogTitle>Delete IP Allowlist</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssociatedPresets.length > 0 ? (
                <div className="space-y-4 mt-4">
                  <p className="text-destructive font-medium">
                    Cannot delete: {deleteAssociatedPresets.length} preset(s) are using this IP allowlist.
                  </p>
                  <p className="text-sm">Please remove this allowlist from the following presets first:</p>
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
                <p>Are you sure you want to delete this IP allowlist? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteAssociatedPresets.length === 0 && (
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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
