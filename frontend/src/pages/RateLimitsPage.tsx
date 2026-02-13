import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { Plus, Edit, Trash2, HelpCircle, Gauge, Timer, Shield, TrendingUp } from 'lucide-react';

export default function RateLimitsPage() {
  const [rateLimits, setRateLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [originalFormData, setOriginalFormData] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    rules: [{ requests: 10, window_seconds: 1 }],
    response_code: 429,
    response_body: '{"error": "Rate limit exceeded"}',
    response_type: 'json',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAssociatedKeys, setDeleteAssociatedKeys] = useState<any[]>([]);
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<number | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [removeRuleDialogOpen, setRemoveRuleDialogOpen] = useState(false);
  const [removeRuleIndex, setRemoveRuleIndex] = useState<number | null>(null);
  const [ruleWarnings, setRuleWarnings] = useState<{ [key: number]: { requests?: string; window_seconds?: string } }>({});

  useEffect(() => {
    loadRateLimits();
  }, []);

  const loadRateLimits = async () => {
    try {
      setLoading(true);
      const res = await api.get('/rate-limits');
      setRateLimits(res.data);
    } catch (error) {
      console.error('Failed to load rate limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateRules = (rules: any[]): string | null => {
    if (rules.length === 0) {
      return 'At least one rate limit rule is required';
    }

    // Sort by window_seconds
    const sortedRules = [...rules].sort((a, b) => a.window_seconds - b.window_seconds);
    
    for (let i = 0; i < sortedRules.length; i++) {
      const rule = sortedRules[i];
      if (rule.requests <= 0 || rule.window_seconds <= 0) {
        return 'Requests and window seconds must be greater than 0';
      }
      
      if (i > 0) {
        const prevRule = sortedRules[i - 1];
        if (rule.requests <= prevRule.requests) {
          return `Rule ${i + 1}: Requests (${rule.requests}) must be greater than previous rule (${prevRule.requests})`;
        }
        if (rule.window_seconds <= prevRule.window_seconds) {
          return `Rule ${i + 1}: Window seconds (${rule.window_seconds}) must be greater than previous rule (${prevRule.window_seconds})`;
        }
      }
    }
    
    return null;
  };

  const hasChanges = (): boolean => {
    if (!originalFormData) return true; // New rate limit always has changes
    
    return (
      formData.name !== originalFormData.name ||
      formData.response_code !== originalFormData.response_code ||
      formData.response_body !== originalFormData.response_body ||
      formData.response_type !== originalFormData.response_type ||
      JSON.stringify(formData.rules) !== JSON.stringify(originalFormData.rules)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateRules(formData.rules);
    if (validationError) {
      setErrorMessage(validationError);
      setErrorDialogOpen(true);
      return;
    }
    
    try {
      if (editing) {
        await api.put(`/rate-limits/${editing.id}`, formData);
      } else {
        await api.post('/rate-limits', formData);
      }
      setOpen(false);
      setEditing(null);
      setOriginalFormData(null);
      setFormData({ name: '', rules: [{ requests: 10, window_seconds: 1 }], response_code: 429, response_body: '{"error": "Rate limit exceeded"}', response_type: 'json' });
      loadRateLimits();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to save rate limit');
      setErrorDialogOpen(true);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget(id);
    try {
      // Check for associated keys before showing dialog
      const res = await api.get(`/rate-limits/${id}/associated-keys`);
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
      await api.delete(`/rate-limits/${deleteTarget}`);
      loadRateLimits();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteAssociatedKeys([]);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.associated_keys) {
        setDeleteAssociatedKeys(error.response.data.associated_keys);
      } else {
        setErrorMessage(error.response?.data?.error || 'Failed to delete rate limit');
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

  const handleEdit = (rateLimit: any) => {
    setEditing(rateLimit);
    const data = {
      name: rateLimit.name,
      rules: rateLimit.rules || [{ requests: 10, window_seconds: 1 }],
      response_code: rateLimit.response_code,
      response_body: rateLimit.response_body,
      response_type: rateLimit.response_type || 'json',
    };
    setFormData(data);
    setOriginalFormData(JSON.parse(JSON.stringify(data))); // Deep copy
    setOpen(true);
  };

  const getMinRequests = (index: number): number => {
    if (index === 0) return 1;
    const sortedRules = [...formData.rules].sort((a, b) => a.window_seconds - b.window_seconds);
    const prevRule = sortedRules[index - 1];
    return prevRule.requests + 1;
  };

  const getMinWindowSeconds = (index: number): number => {
    if (index === 0) return 1;
    const sortedRules = [...formData.rules].sort((a, b) => a.window_seconds - b.window_seconds);
    const prevRule = sortedRules[index - 1];
    return prevRule.window_seconds + 1;
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Rate Limits</h2>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setOriginalFormData(null);
            setFormData({ name: '', rules: [{ requests: 10, window_seconds: 1 }], response_code: 429, response_body: '{"error": "Rate limit exceeded"}', response_type: 'json' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Rate Limit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Create'} Rate Limit</DialogTitle>
              <DialogDescription>
                Define multiple rate limits (must be in ascending order)
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
                  <div className="flex items-center gap-2 mb-2">
                    <Label>Rate Limit Rules</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Define multiple rate limit rules that must increase in both requests and time window. 
                            Each rule must have more requests and a longer time window than the previous one.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {formData.rules.map((rule, idx) => {
                    const sortedRules = [...formData.rules].sort((a, b) => a.window_seconds - b.window_seconds);
                    const sortedIndex = sortedRules.findIndex(r => r === rule);
                    const minRequests = sortedIndex > 0 ? sortedRules[sortedIndex - 1].requests + 1 : 1;
                    const minWindowSeconds = sortedIndex > 0 ? sortedRules[sortedIndex - 1].window_seconds + 1 : 1;
                    
                    const requestsWarning = rule.requests < minRequests ? `Must be at least ${minRequests}` : undefined;
                    const windowSecondsWarning = rule.window_seconds < minWindowSeconds ? `Must be at least ${minWindowSeconds}` : undefined;
                    
                    return (
                      <div key={idx} className="flex gap-2 mb-2 items-center flex-wrap">
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min={minRequests}
                            placeholder="Requests"
                            value={rule.requests || ''}
                            onChange={(e) => {
                              const inputVal = e.target.value;
                              const numVal = inputVal === '' ? 0 : parseInt(inputVal);
                              const newRules = [...formData.rules];
                              newRules[idx].requests = isNaN(numVal) ? 0 : numVal;
                              setFormData({ ...formData, rules: newRules });
                            }}
                            className={cn(
                              "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                              requestsWarning && "border-destructive focus-visible:ring-destructive"
                            )}
                            style={{
                              MozAppearance: 'textfield',
                            }}
                            required
                          />
                          <span className="self-center whitespace-nowrap text-xs text-muted-foreground">(min: {minRequests})</span>
                        </div>
                        {requestsWarning && (
                          <span className="text-xs text-destructive">{requestsWarning}</span>
                        )}
                        <span className="self-center whitespace-nowrap">requests every</span>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min={minWindowSeconds}
                            placeholder="Seconds"
                            value={rule.window_seconds || ''}
                            onChange={(e) => {
                              const inputVal = e.target.value;
                              const numVal = inputVal === '' ? 0 : parseInt(inputVal);
                              const newRules = [...formData.rules];
                              newRules[idx].window_seconds = isNaN(numVal) ? 0 : numVal;
                              setFormData({ ...formData, rules: newRules });
                            }}
                            className={cn(
                              "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                              windowSecondsWarning && "border-destructive focus-visible:ring-destructive"
                            )}
                            style={{
                              MozAppearance: 'textfield',
                            }}
                            required
                          />
                          <span className="self-center whitespace-nowrap text-xs text-muted-foreground">(min: {minWindowSeconds})</span>
                        </div>
                        {windowSecondsWarning && (
                          <span className="text-xs text-destructive">{windowSecondsWarning}</span>
                        )}
                        <span className="self-center whitespace-nowrap">seconds</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setRemoveRuleIndex(idx);
                                  setRemoveRuleDialogOpen(true);
                                }}
                              >
                                Remove
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove this rate limit rule</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    );
                  })}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const sortedRules = [...formData.rules].sort((a, b) => a.window_seconds - b.window_seconds);
                            const lastRule = sortedRules[sortedRules.length - 1];
                            const newRule = {
                              requests: lastRule.requests + 1,
                              window_seconds: lastRule.window_seconds + 1,
                            };
                            setFormData({
                              ...formData,
                              rules: [...formData.rules, newRule],
                            });
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Rule
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add a new rate limit rule. The new rule must have higher values than the previous one.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
                            The content type of the response body when rate limit is exceeded. 
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
                <Button 
                  type="submit" 
                  disabled={!hasChanges() || formData.rules.length === 0}
                >
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!loading && rateLimits.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Gauge className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Control API Traffic</CardTitle>
              <CardDescription className="mb-4">
                Create rate limits to prevent API abuse and ensure fair usage. Set multiple rules for different time windows.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Timer className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Multiple Time Windows</CardTitle>
              <CardDescription className="mb-4">
                Define rate limits with increasing strictness (e.g., 10 req/sec, 100 req/min) to handle traffic spikes gracefully.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Protect Your APIs</CardTitle>
              <CardDescription className="mb-4">
                Prevent DDoS attacks and API abuse by limiting request rates. Customize response codes and messages for rate limit violations.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <TrendingUp className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Per-Key Configuration</CardTitle>
              <CardDescription className="mb-4">
                Assign different rate limits to different API keys, allowing you to offer tiered access levels to your users.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {rateLimits.map((rateLimit) => (
          <Card key={rateLimit.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{rateLimit.name}</CardTitle>
                  <CardDescription>
                    Response Code: {rateLimit.response_code} | Type: {(rateLimit.response_type || 'json').toUpperCase()}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(rateLimit)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit rate limit configuration</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(rateLimit.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete this rate limit</p>
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
                    {rateLimit.usage?.api_key_count > 0 ? (
                      <div className="space-y-1">
                        <p>
                          Used by <strong>{rateLimit.usage.api_key_count}</strong> API key{rateLimit.usage.api_key_count !== 1 ? 's' : ''} 
                          {' '}across <strong>{rateLimit.usage.project_count}</strong> API{rateLimit.usage.project_count !== 1 ? 's' : ''}:
                        </p>
                        <ul className="list-disc list-inside ml-2 text-muted-foreground">
                          {rateLimit.usage.project_names?.map((projectName: string, idx: number) => (
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
                  <strong>Rules:</strong>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requests</TableHead>
                        <TableHead>Window (seconds)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rateLimit.rules?.map((rule: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{rule.requests}</TableCell>
                          <TableCell>{rule.window_seconds}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <strong>Response Body:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded text-sm">{rateLimit.response_body}</pre>
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
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Limit</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssociatedKeys.length > 0 ? (
                <div className="space-y-4 mt-4">
                  <p className="text-destructive font-medium">
                    Cannot delete: {deleteAssociatedKeys.length} API key(s) are using this rate limit.
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
                      <p className="text-sm mb-2">All associated API keys have been deleted. You can now delete this rate limit.</p>
                      <Button
                        variant="destructive"
                        onClick={confirmDelete}
                      >
                        Delete Rate Limit
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p>Are you sure you want to delete this rate limit? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteAssociatedKeys.length === 0 && (
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Rule Confirmation Dialog */}
      <AlertDialog open={removeRuleDialogOpen} onOpenChange={setRemoveRuleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Rate Limit Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this rate limit rule?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (removeRuleIndex !== null) {
                const newRules = formData.rules.filter((_, i) => i !== removeRuleIndex);
                setFormData({ ...formData, rules: newRules });
                setRemoveRuleIndex(null);
                setRemoveRuleDialogOpen(false);
              }
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Associated Key Confirmation Dialog */}
      <AlertDialog open={deleteKeyDialogOpen} onOpenChange={setDeleteKeyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAssociatedKey}>Delete</AlertDialogAction>
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
