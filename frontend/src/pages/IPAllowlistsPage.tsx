import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import api from '@/lib/api';
import { Plus, Edit, Trash2, HelpCircle, ShieldCheck, Ban, AlertTriangle, Lock } from 'lucide-react';

// IP validation function (same as blocklists)
function validateIP(ip: string): { valid: boolean; error?: string } {
  if (!ip || !ip.trim()) return { valid: false, error: 'IP cannot be empty' };
  
  // Check if it's a wildcard pattern (contains *)
  if (ip.includes('*')) {
    // Validate wildcard pattern: should be like 192.168.*.* or 192.168.1.*
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return { valid: false, error: 'Wildcard patterns must have exactly 4 parts (e.g., 1.*.*.*)' };
    }
    
    // Don't allow patterns like 1.* (must be 1.*.*.*)
    let hasWildcard = false;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '*') {
        hasWildcard = true;
        // If we have a wildcard, all subsequent parts must also be wildcards
        for (let j = i + 1; j < parts.length; j++) {
          if (parts[j] !== '*') {
            return { valid: false, error: 'Wildcards must be at the end (e.g., 1.*.*.*, not 1.*.2.3)' };
          }
        }
        break;
      }
      if (part === '') return { valid: false, error: 'Empty part in IP address' };
      
      // If part contains *, it should only be *
      if (part.includes('*') && part !== '*') {
        return { valid: false, error: 'Invalid wildcard format' };
      }
      
      // If no *, should be a valid number
      if (!part.includes('*')) {
        const num = parseInt(part);
        if (isNaN(num) || num < 0 || num > 255) {
          return { valid: false, error: `Invalid number: ${part} (must be 0-255)` };
        }
      }
    }
    
    if (!hasWildcard) {
      return { valid: false, error: 'Wildcard pattern must contain at least one *' };
    }
    
    return { valid: true };
  }
  
  // Validate regular IP address (IPv4)
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip.trim())) {
    return { valid: false, error: 'Invalid IP address format' };
  }
  
  return { valid: true };
}

export default function IPAllowlistsPage() {
  const [allowlists, setAllowlists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    ips: '',
    response_code: 403,
    response_body: '{"error": "IP not allowed"}',
    response_type: 'json',
  });
  const [ipErrors, setIpErrors] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAssociatedKeys, setDeleteAssociatedKeys] = useState<any[]>([]);
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<number | null>(null);
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
      // Check for associated keys before showing dialog
      const res = await api.get(`/ip-allowlists/${id}/associated-keys`);
      if (res.data.associated_keys && res.data.associated_keys.length > 0) {
        setDeleteAssociatedKeys(res.data.associated_keys);
      } else {
        setDeleteAssociatedKeys([]);
      }
    } catch (error: any) {
      setDeleteAssociatedKeys([]);
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
      setDeleteAssociatedKeys([]);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.associated_keys) {
        setDeleteAssociatedKeys(error.response.data.associated_keys);
      } else {
        setErrorMessage(error.response?.data?.error || 'Failed to delete allowlist');
        setErrorDialogOpen(true);
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        setDeleteAssociatedKeys([]);
      }
    }
  };

  const handleDeleteAssociatedKey = (keyId: number) => {
    setDeleteKeyTarget(keyId);
    setDeleteKeyDialogOpen(true);
  };

  const confirmDeleteAssociatedKey = async () => {
    if (!deleteKeyTarget) return;
    try {
      await api.delete(`/api-keys/${deleteKeyTarget}`);
      // Remove from associated keys list
      setDeleteAssociatedKeys(prev => prev.filter((k: any) => k.id !== deleteKeyTarget));
      setDeleteKeyDialogOpen(false);
      setDeleteKeyTarget(null);
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to delete API key');
      setErrorDialogOpen(true);
      setDeleteKeyDialogOpen(false);
      setDeleteKeyTarget(null);
    }
  };

  const handleEdit = (allowlist: any) => {
    setEditing(allowlist);
    setFormData({
      name: allowlist.name,
      ips: allowlist.ips,
      response_code: allowlist.response_code,
      response_body: allowlist.response_body,
      response_type: allowlist.response_type || 'json',
    });
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
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="ips">IPs/Patterns (one per line)</Label>
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
                  <p className="text-sm text-muted-foreground mb-2">
                    This response will be sent when a request comes from an IP address that is not in the allowlist.
                  </p>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="response_type">Response Type</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            The content type of the response body when an IP is not allowed. 
                            Choose JSON, Text, or XML based on your API's response format.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.response_type}
                    onValueChange={(value) => setFormData({ ...formData, response_type: value })}
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
                  <Label htmlFor="response_code">Response Code</Label>
                  <Input
                    id="response_code"
                    type="number"
                    value={formData.response_code}
                    onChange={(e) => setFormData({ ...formData, response_code: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="response_body">Response Body</Label>
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
                <Button type="submit">Save</Button>
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
              <CardTitle className="mb-2">Per-Key Configuration</CardTitle>
              <CardDescription className="mb-4">
                Assign allowlists to specific API keys for granular control over which IPs can access your endpoints.
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
                    {allowlist.usage?.api_key_count > 0 ? (
                      <div className="space-y-1">
                        <p>
                          Used by <strong>{allowlist.usage.api_key_count}</strong> API key{allowlist.usage.api_key_count !== 1 ? 's' : ''} 
                          {' '}across <strong>{allowlist.usage.project_count}</strong> project{allowlist.usage.project_count !== 1 ? 's' : ''}:
                        </p>
                        <ul className="list-disc list-inside ml-2 text-muted-foreground">
                          {allowlist.usage.project_names?.map((projectName: string, idx: number) => (
                            <li key={idx}>{projectName}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Not used by any API keys</p>
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
          setDeleteAssociatedKeys([]);
        }
      }}>
        <AlertDialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Allowlist</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssociatedKeys.length > 0 ? (
                <div className="space-y-4 mt-4">
                  <p className="text-destructive font-medium">
                    Cannot delete: {deleteAssociatedKeys.length} API key(s) are using this IP allowlist.
                  </p>
                  <p className="text-sm">Please delete the following API keys first:</p>
                  <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                    {deleteAssociatedKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1">
                          <p className="font-mono text-xs">{key.key_value}</p>
                          {key.project_name && <p className="text-xs text-muted-foreground">Project: {key.project_name}</p>}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteAssociatedKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {deleteAssociatedKeys.length === 0 && deleteTarget && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm mb-2">All associated API keys have been deleted. You can now delete this IP allowlist.</p>
                      <Button
                        variant="destructive"
                        onClick={confirmDelete}
                      >
                        Delete IP Allowlist
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p>Are you sure you want to delete this IP allowlist? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteAssociatedKeys.length === 0 && (
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Associated Key Confirmation Dialog */}
      <AlertDialog open={deleteKeyDialogOpen} onOpenChange={setDeleteKeyDialogOpen}>
        <AlertDialogContent onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAssociatedKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
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
