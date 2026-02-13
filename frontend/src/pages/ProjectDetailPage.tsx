import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { getCurrentAccount } from '@/lib/auth';
import { Plus, Edit, Trash2, ArrowLeft, PlusCircle, HelpCircle, ChevronRight, ChevronDown, MoreVertical, Eye, EyeOff, RotateCcw, Key, Shield, ShieldCheck } from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [rateLimits, setRateLimits] = useState<any[]>([]);
  const [ipBlocklists, setIpBlocklists] = useState<any[]>([]);
  const [ipAllowlists, setIpAllowlists] = useState<any[]>([]);
  const [endpointGroups, setEndpointGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [keyFormData, setKeyFormData] = useState({
    name: '',
    rate_limit_id: '',
    ip_blocklist_id: '',
    ip_allowlist_id: '',
    user_id: '',
    notes: '',
    allowed_methods: [] as string[],
    allowed_endpoint_group_ids: [] as number[],
    expiry_date: '',
    expiry_time: '',
    expiry_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    expiry_usage_limit: '',
    expiry_response_code: 403,
    expiry_response_body: '{"error": "API key expired"}',
    expiry_response_type: 'json',
  });
  const [currentTimezoneTime, setCurrentTimezoneTime] = useState<string>('');
  const [expirySettingsOpen, setExpirySettingsOpen] = useState(false);
  const [originalKeyFormData, setOriginalKeyFormData] = useState<any>(null);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const [restrictionType, setRestrictionType] = useState<'none' | 'blocklist' | 'allowlist'>('none');
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Common timezones list
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney',
    'America/Sao_Paulo',
    'America/Mexico_City',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Europe/Moscow',
  ];

  // Update current time in selected timezone
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: keyFormData.expiry_timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setCurrentTimezoneTime(formatter.format(now));
      } catch (e) {
        setCurrentTimezoneTime('');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [keyFormData.expiry_timezone]);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    endpoints: [{ url_pattern: '', method: 'GET' }],
  });
  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<{ groupId: number; endpoint: any } | null>(null);
  const [endpointFormData, setEndpointFormData] = useState({
    url_pattern: '',
    method: 'GET',
  });
  const [urlPatternError, setUrlPatternError] = useState<string>('');
  const [externalApiUrlError, setExternalApiUrlError] = useState<string>('');
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<number | null>(null);
  const [rotateKeyDialogOpen, setRotateKeyDialogOpen] = useState(false);
  const [rotateKeyTarget, setRotateKeyTarget] = useState<number | null>(null);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<number | null>(null);
  const [deleteGroupAssociatedKeys, setDeleteGroupAssociatedKeys] = useState<any[]>([]);
  const [deleteGroupKeyDialogOpen, setDeleteGroupKeyDialogOpen] = useState(false);
  const [deleteGroupKeyTarget, setDeleteGroupKeyTarget] = useState<number | null>(null);
  const [openGroupMenuId, setOpenGroupMenuId] = useState<number | null>(null);
  const [deleteEndpointDialogOpen, setDeleteEndpointDialogOpen] = useState(false);
  const [deleteEndpointTarget, setDeleteEndpointTarget] = useState<{ groupId: number; endpointId: number } | null>(null);
  const { toast } = useToast();
  const [projectEditDialogOpen, setProjectEditDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<number>>(new Set());
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    description: '',
    secret_api_key: '',
    external_api_base_url: '',
    timeout_seconds: '',
    timeout_response_code: '504',
    timeout_response_body: '{"error": "Request timeout"}',
    timeout_response_type: 'json',
  });

  const getBackendUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    // Extract base URL (remove /api)
    const baseUrl = apiUrl.replace('/api', '');
    return baseUrl;
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadApiKeys();
      loadRateLimits();
      loadIpBlocklists();
      loadIpAllowlists();
      loadUsers();
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
      setEndpointGroups(res.data.endpoint_groups || []);
      // Set form data for editing
      setProjectFormData({
        name: res.data.name || '',
        description: res.data.description || '',
        secret_api_key: res.data.secret_api_key || '',
        external_api_base_url: res.data.external_api_base_url || res.data.external_api_url || '',
        timeout_seconds: res.data.timeout_seconds?.toString() || '',
        timeout_response_code: res.data.timeout_response_code?.toString() || '504',
        timeout_response_body: res.data.timeout_response_body || '{"error": "Request timeout"}',
        timeout_response_type: res.data.timeout_response_type || 'json',
      });
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/api-keys`);
      setApiKeys(res.data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const loadRateLimits = async () => {
    try {
      const res = await api.get('/rate-limits');
      setRateLimits(res.data);
    } catch (error) {
      console.error('Failed to load rate limits:', error);
    }
  };

  const loadIpBlocklists = async () => {
    try {
      const res = await api.get('/ip-blocklists');
      setIpBlocklists(res.data);
    } catch (error) {
      console.error('Failed to load IP blocklists:', error);
    }
  };

  const loadIpAllowlists = async () => {
    try {
      const res = await api.get('/ip-allowlists');
      setIpAllowlists(res.data);
    } catch (error) {
      console.error('Failed to load IP allowlists:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
    }
    
    const diffInYears = Math.floor(diffInMonths / 12);
    return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
  };

  // Check if form has changes
  const hasFormChanges = useMemo(() => {
    if (!editingKey) {
      // New key - check if all required fields are filled
      return !!(
        keyFormData.name &&
        keyFormData.rate_limit_id &&
        keyFormData.allowed_methods.length > 0 &&
        keyFormData.allowed_endpoint_group_ids.length > 0
      );
    }
    
    if (!originalKeyFormData) return false;
    
      // Compare current form data with original
      return (
        keyFormData.name !== originalKeyFormData.name ||
        keyFormData.rate_limit_id !== originalKeyFormData.rate_limit_id ||
        keyFormData.ip_blocklist_id !== originalKeyFormData.ip_blocklist_id ||
        keyFormData.ip_allowlist_id !== originalKeyFormData.ip_allowlist_id ||
        keyFormData.user_id !== originalKeyFormData.user_id ||
        keyFormData.notes !== originalKeyFormData.notes ||
      JSON.stringify([...keyFormData.allowed_methods].sort()) !== JSON.stringify([...(originalKeyFormData.allowed_methods || [])].sort()) ||
      JSON.stringify([...keyFormData.allowed_endpoint_group_ids].sort()) !== JSON.stringify([...(originalKeyFormData.allowed_endpoint_group_ids || [])].sort()) ||
      keyFormData.expiry_date !== originalKeyFormData.expiry_date ||
      keyFormData.expiry_time !== originalKeyFormData.expiry_time ||
      keyFormData.expiry_timezone !== originalKeyFormData.expiry_timezone ||
      keyFormData.expiry_usage_limit !== originalKeyFormData.expiry_usage_limit ||
      keyFormData.expiry_response_code !== originalKeyFormData.expiry_response_code ||
      keyFormData.expiry_response_body !== originalKeyFormData.expiry_response_body ||
      keyFormData.expiry_response_type !== originalKeyFormData.expiry_response_type
    );
  }, [keyFormData, originalKeyFormData, editingKey]);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSave(true);
    
    // Validate required fields
    if (keyFormData.allowed_methods.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'At least one allowed method must be selected',
      });
      return;
    }
    
    if (keyFormData.allowed_endpoint_group_ids.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'At least one allowed endpoint group must be selected',
      });
      return;
    }
    
    // Validate restriction rule is selected if restriction type is set
    if (restrictionType === 'blocklist' && !keyFormData.ip_blocklist_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a blacklist rule',
      });
      return;
    }
    
    if (restrictionType === 'allowlist' && !keyFormData.ip_allowlist_id) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a whitelist rule',
      });
      return;
    }
    
    // Validate date and time are both set if one is set
    if ((keyFormData.expiry_date && !keyFormData.expiry_time) || (!keyFormData.expiry_date && keyFormData.expiry_time)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Both expiry date and time must be set together',
      });
      return;
    }
    
    try {
      // Combine date and time into expiry_date
      let expiry_date = null;
      if (keyFormData.expiry_date && keyFormData.expiry_time) {
        const dateTime = new Date(`${keyFormData.expiry_date}T${keyFormData.expiry_time}`);
        // Convert to UTC for storage
        expiry_date = dateTime.toISOString();
      }
      
      const data = {
        name: keyFormData.name,
        ...keyFormData,
        allowed_methods: Array.isArray(keyFormData.allowed_methods) 
          ? keyFormData.allowed_methods.join(',') 
          : keyFormData.allowed_methods,
        allowed_endpoint_group_ids: keyFormData.allowed_endpoint_group_ids,
        expiry_date: expiry_date,
        expiry_usage_limit: keyFormData.expiry_usage_limit ? parseInt(keyFormData.expiry_usage_limit) : null,
      };
      if (editingKey) {
        await api.put(`/api-keys/${editingKey.id}`, data);
      } else {
        await api.post(`/projects/${projectId}/api-keys`, data);
      }
      setKeyDialogOpen(false);
      setEditingKey(null);
      setOriginalKeyFormData(null);
      setHasAttemptedSave(false);
      setRestrictionType('none');
      setKeyFormData({
        name: '',
        rate_limit_id: '',
        ip_blocklist_id: '',
        ip_allowlist_id: '',
        user_id: '',
        notes: '',
        allowed_methods: [],
        allowed_endpoint_group_ids: [],
        expiry_date: '',
        expiry_time: '',
        expiry_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        expiry_usage_limit: '',
        expiry_response_code: 403,
        expiry_response_body: '{"error": "API key expired"}',
        expiry_response_type: 'json',
      });
      setExpirySettingsOpen(false);
      toast({
        title: 'Success',
        description: editingKey ? 'API key updated successfully' : 'API key created successfully',
      });
      loadApiKeys();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save API key',
      });
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
        await api.post(`/projects/${projectId}/endpoint-groups`, {
          name: groupFormData.name,
          description: groupFormData.description,
          endpoints: [],
        });
      }
      setGroupDialogOpen(false);
      setEditingGroup(null);
      setGroupFormData({ name: '', description: '', endpoints: [{ url_pattern: '', method: 'GET' }] });
      toast({
        title: 'Success',
        description: editingGroup ? 'Endpoint group updated successfully' : 'Endpoint group created successfully',
      });
      loadProject();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save endpoint group',
      });
    }
  };

  const handleEndpointSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEndpoint) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No endpoint group selected',
      });
      return;
    }

    // Validate URL pattern: max 1 wildcard
    const wildcardCount = (endpointFormData.url_pattern.match(/\*/g) || []).length;
    if (wildcardCount > 1) {
      setUrlPatternError('URL pattern cannot contain more than one wildcard (*)');
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'URL pattern cannot contain more than one wildcard (*)',
      });
      return;
    }

    // Validate external API base URL: no wildcards
    const baseUrl = project?.external_api_base_url || project?.external_api_url || '';
    if (baseUrl.includes('*')) {
      setExternalApiUrlError('External API base URL cannot contain wildcards (*)');
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'External API base URL cannot contain wildcards (*)',
      });
      return;
    }

    setUrlPatternError('');
    setExternalApiUrlError('');

    try {
      const group = endpointGroups.find(g => g.id === editingEndpoint.groupId);
      if (!group) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Endpoint group not found',
        });
        return;
      }

      const existingEndpoints = group.endpoints || [];
      let updatedEndpoints;

      if (editingEndpoint.endpoint && editingEndpoint.endpoint.id) {
        // Editing existing endpoint
        updatedEndpoints = existingEndpoints.map((ep: any) =>
          ep.id === editingEndpoint.endpoint.id
            ? { ...endpointFormData, id: ep.id }
            : ep
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
      setEndpointFormData({ url_pattern: '', method: 'GET' });
      setUrlPatternError('');
      toast({
        title: 'Success',
        description: editingEndpoint.endpoint ? 'Endpoint updated successfully' : 'Endpoint added successfully',
      });
      loadProject();
    } catch (error: any) {
      console.error('Error saving endpoint:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save endpoint',
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
      const group = endpointGroups.find(g => g.id === deleteEndpointTarget.groupId);
      if (!group) return;

      const updatedEndpoints = (group.endpoints || []).filter((ep: any) => ep.id !== deleteEndpointTarget.endpointId);

      await api.put(`/endpoint-groups/${deleteEndpointTarget.groupId}`, {
        name: group.name,
        endpoints: updatedEndpoints,
      });

      toast({
        title: 'Success',
        description: 'Endpoint deleted successfully',
      });
      loadProject();
      setDeleteEndpointDialogOpen(false);
      setDeleteEndpointTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete endpoint',
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
      setEndpointFormData({ url_pattern: '', method: 'GET' });
    }
    setEndpointDialogOpen(true);
  };

  const handleDeleteKey = async (id: number) => {
    setDeleteKeyTarget(id);
    setDeleteKeyDialogOpen(true);
  };

  const confirmDeleteKey = async () => {
    if (!deleteKeyTarget) return;
    try {
      await api.delete(`/api-keys/${deleteKeyTarget}`);
      toast({
        title: 'Success',
        description: 'API key deleted successfully',
      });
      loadApiKeys();
      setDeleteKeyDialogOpen(false);
      setDeleteKeyTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete API key',
      });
      setDeleteKeyDialogOpen(false);
      setDeleteKeyTarget(null);
    }
  };
  
  const handleRotateKey = (id: number) => {
    setRotateKeyTarget(id);
    setRotateKeyDialogOpen(true);
  };
  
  const confirmRotateKey = async () => {
    if (!rotateKeyTarget) return;
    const account = getCurrentAccount();
    if (!account) return;
    
    try {
      const res = await api.post(`/api-keys/${rotateKeyTarget}/rotate`, {
        account_id: account.id,
      });
      toast({
        title: 'Success',
        description: 'API key rotated successfully. The old key is no longer valid.',
      });
      loadApiKeys();
      setRotateKeyDialogOpen(false);
      setRotateKeyTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to rotate API key',
      });
      setRotateKeyDialogOpen(false);
      setRotateKeyTarget(null);
    }
  };

  const handleEditGroup = (group: any) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description || '',
      endpoints: group.endpoints || [],
    });
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = async (id: number) => {
    setDeleteGroupTarget(id);
    try {
      // Check for associated keys before showing dialog
      const res = await api.get(`/endpoint-groups/${id}/associated-keys`);
      if (res.data.associated_keys && res.data.associated_keys.length > 0) {
        setDeleteGroupAssociatedKeys(res.data.associated_keys);
      } else {
        setDeleteGroupAssociatedKeys([]);
      }
    } catch (error: any) {
      setDeleteGroupAssociatedKeys([]);
    }
    setDeleteGroupDialogOpen(true);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    try {
      const response = await api.delete(`/endpoint-groups/${deleteGroupTarget}`);
      loadProject();
      toast({
        title: 'Success',
        description: 'Endpoint group deleted successfully',
      });
      loadProject();
      setDeleteGroupDialogOpen(false);
      setDeleteGroupTarget(null);
      setDeleteGroupAssociatedKeys([]);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.associated_keys) {
        setDeleteGroupAssociatedKeys(error.response.data.associated_keys);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.response?.data?.error || 'Failed to delete endpoint group',
        });
        setDeleteGroupDialogOpen(false);
        setDeleteGroupTarget(null);
        setDeleteGroupAssociatedKeys([]);
      }
    }
  };

  const handleDeleteAssociatedKey = (keyId: number) => {
    setDeleteGroupKeyTarget(keyId);
    setDeleteGroupKeyDialogOpen(true);
  };

  const confirmDeleteAssociatedKey = async () => {
    if (!deleteGroupKeyTarget) return;
    try {
      await api.delete(`/api-keys/${deleteGroupKeyTarget}`);
      loadApiKeys();
      // Remove from associated keys list
      setDeleteGroupAssociatedKeys(prev => prev.filter((k: any) => k.id !== deleteGroupKeyTarget));
      toast({
        title: 'Success',
        description: 'API key deleted successfully',
      });
      loadApiKeys();
      // Remove from associated keys list
      setDeleteGroupAssociatedKeys(prev => prev.filter((k: any) => k.id !== deleteGroupKeyTarget));
      setDeleteGroupKeyDialogOpen(false);
      setDeleteGroupKeyTarget(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete API key',
      });
      setDeleteGroupKeyDialogOpen(false);
      setDeleteGroupKeyTarget(null);
    }
  };

  const handleProjectEdit = () => {
    setProjectEditDialogOpen(true);
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${projectId}`, {
        ...projectFormData,
        timeout_seconds: projectFormData.timeout_seconds ? parseInt(projectFormData.timeout_seconds) : null,
        timeout_response_code: parseInt(projectFormData.timeout_response_code),
      });
      toast({
        title: 'Success',
        description: 'Project updated successfully',
      });
      setProjectEditDialogOpen(false);
      loadProject();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update project',
      });
    }
  };

  if (!project) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link to="/" className="hover:text-foreground transition-colors">APIs</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{project?.name || 'Loading...'}</span>
      </div>

      {/* Project Details Header */}
      {project && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <CardTitle className="text-3xl">{project.name}</CardTitle>
                  <Button variant="outline" size="sm" onClick={handleProjectEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  {project.description && (
                    <p className="text-muted-foreground">{project.description}</p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Path:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">/{project.unique_path}</code>
                      <span className="text-sm text-muted-foreground">|</span>
                      <span className="text-sm font-medium text-muted-foreground">Gateway:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{getBackendUrl()}/{project.unique_path}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Base URL:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{project.external_api_base_url || project.external_api_url}</code>
                    </div>
                    {project.timeout_seconds && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Timeout:</span>
                        <span className="text-sm">{project.timeout_seconds} seconds</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground">API Keys</span>
                      <p className="text-lg font-semibold">{apiKeys.length}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Endpoint Groups</span>
                      <p className="text-lg font-semibold">{endpointGroups.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Project Edit Dialog */}
      <Dialog open={projectEditDialogOpen} onOpenChange={(o) => {
        setProjectEditDialogOpen(o);
        if (!o && project) {
          // Reset form data when closing
          setExternalApiUrlError('');
          setProjectFormData({
            name: project.name || '',
            description: project.description || '',
            secret_api_key: project.secret_api_key || '',
            external_api_base_url: project.external_api_base_url || project.external_api_url || '',
            timeout_seconds: project.timeout_seconds?.toString() || '',
            timeout_response_code: project.timeout_response_code?.toString() || '504',
            timeout_response_body: project.timeout_response_body || '{"error": "Request timeout"}',
            timeout_response_type: project.timeout_response_type || 'json',
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project settings including name, description, and timeout configuration
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProjectSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="project-name">Name *</Label>
                <Input
                  id="project-name"
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                  placeholder="Project description"
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
                          The master API key from your external API service. This key will be used to authenticate 
                          all requests forwarded through the gateway.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="project-secret-key"
                  type="password"
                  value={projectFormData.secret_api_key}
                  onChange={(e) => setProjectFormData({ ...projectFormData, secret_api_key: e.target.value })}
                  required
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="project-base-url">External API Base URL *</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          The base URL of the external API that requests will be forwarded to.
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
                    setProjectFormData({ ...projectFormData, external_api_base_url: value });
                    // Validate: no wildcards in base URL
                    if (value.includes('*')) {
                      setExternalApiUrlError('External API base URL cannot contain wildcards (*)');
                    } else {
                      setExternalApiUrlError('');
                    }
                  }}
                  placeholder="https://api.example.com"
                  required
                  className={externalApiUrlError ? 'border-destructive' : ''}
                />
                {externalApiUrlError && (
                  <p className="mt-1 text-xs text-destructive">{externalApiUrlError}</p>
                )}
              </div>
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-4">Timeout Configuration</h3>
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
                              Maximum time in seconds to wait for a response from the external API. 
                              Leave empty for no timeout.
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
                      onChange={(e) => setProjectFormData({ ...projectFormData, timeout_seconds: e.target.value })}
                      placeholder="e.g., 30"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="timeout-response-code">Timeout Response Code</Label>
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
                      onChange={(e) => setProjectFormData({ ...projectFormData, timeout_response_code: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="timeout-response-type">Timeout Response Type</Label>
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
                      onValueChange={(value) => setProjectFormData({ ...projectFormData, timeout_response_type: value })}
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
                      <Label htmlFor="timeout-response-body">Timeout Response Body</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Response body to return when a timeout occurs. For JSON, use valid JSON format.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      id="timeout-response-body"
                      value={projectFormData.timeout_response_body}
                      onChange={(e) => setProjectFormData({ ...projectFormData, timeout_response_body: e.target.value })}
                      placeholder='{"error": "Request timeout"}'
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
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
                <CardDescription>Manage endpoint groups for this project</CardDescription>
              </div>
              <Dialog open={groupDialogOpen} onOpenChange={(o) => {
                setGroupDialogOpen(o);
                if (!o) {
                  setEditingGroup(null);
                  setGroupFormData({ name: '', description: '', endpoints: [] });
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {editingGroup ? 'Edit Group' : 'New Group'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingGroup ? 'Edit' : 'Create'} Endpoint Group</DialogTitle>
                    <DialogDescription>
                      Create an endpoint group. You can add endpoints after creating the group.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleGroupSubmit}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Name *</Label>
                        <Input
                          value={groupFormData.name}
                          onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={groupFormData.description}
                          onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                          placeholder="e.g., Endpoints allowed for jr developer"
                          rows={3}
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
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...endpointGroups].sort((a, b) => {
                const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                return aDate - bDate;
              }).map((group, index) => (
                <Card key={group.id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg">{index + 1}. {group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="mt-1">{group.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEndpointDialog(group.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Endpoint
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Add a new endpoint URL pattern to this group</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Popover open={openGroupMenuId === group.id} onOpenChange={(open) => setOpenGroupMenuId(open ? group.id : null)}>
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
                                        endpoint.method === 'GET' ? '#10b981' :
                                        endpoint.method === 'POST' ? '#3b82f6' :
                                        endpoint.method === 'PUT' ? '#f59e0b' :
                                        endpoint.method === 'PATCH' ? '#8b5cf6' :
                                        endpoint.method === 'DELETE' ? '#ef4444' : '#6b7280'
                                    }}
                                  >
                                    {endpoint.method}
                                  </span>
                                  <span className="font-mono text-sm">{endpoint.url_pattern}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEndpointDialog(group.id, endpoint)}
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
                                        onClick={() => handleDeleteEndpoint(group.id, endpoint.id)}
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
          <Dialog open={endpointDialogOpen} onOpenChange={(o) => {
            setEndpointDialogOpen(o);
            if (!o) {
              setEditingEndpoint(null);
              setEndpointFormData({ url_pattern: '', method: 'GET' });
              setUrlPatternError('');
            }
          }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEndpoint?.endpoint ? 'Edit' : 'Add'} Endpoint</DialogTitle>
                <DialogDescription>
                  {project && (
                    <div className="space-y-1">
                      <p>Add endpoint for this base URL:</p>
                      <p className="font-mono text-sm bg-muted p-2 rounded">{project.external_api_base_url || project.external_api_url}</p>
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
                              Define URL patterns that match endpoints. Use * as a wildcard to match any segment. 
                              For example: /api/*/users matches /api/v1/users, /api/v2/users, etc.
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
                        setEndpointFormData({ ...endpointFormData, url_pattern: value });
                        // Validate: max 1 wildcard
                        const wildcardCount = (value.match(/\*/g) || []).length;
                        if (wildcardCount > 1) {
                          setUrlPatternError('URL pattern cannot contain more than one wildcard (*)');
                        } else {
                          setUrlPatternError('');
                        }
                      }}
                      required
                      className={urlPatternError ? 'border-destructive' : ''}
                    />
                    {urlPatternError && (
                      <p className="mt-1 text-xs text-destructive">{urlPatternError}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use * for wildcards (e.g., /api/*/users). Note: /* and /*/ are different patterns - /* matches any single segment, while /*/ matches any segment followed by a slash. Maximum one wildcard (*) allowed per pattern.
                    </p>
                  </div>
                  <div>
                    <Label>HTTP Method</Label>
                    <Select
                      value={endpointFormData.method}
                      onValueChange={(value) => setEndpointFormData({ ...endpointFormData, method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {endpointFormData.method && (
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: 
                                    endpointFormData.method === 'GET' ? '#10b981' :
                                    endpointFormData.method === 'POST' ? '#3b82f6' :
                                    endpointFormData.method === 'PUT' ? '#f59e0b' :
                                    endpointFormData.method === 'PATCH' ? '#8b5cf6' :
                                    endpointFormData.method === 'DELETE' ? '#ef4444' : '#6b7280'
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
                                endpointFormData.method === 'GET' ? '#10b981' :
                                endpointFormData.method === 'POST' ? '#3b82f6' :
                                endpointFormData.method === 'PUT' ? '#f59e0b' :
                                endpointFormData.method === 'PATCH' ? '#8b5cf6' :
                                endpointFormData.method === 'DELETE' ? '#ef4444' : '#6b7280'
                            }}
                          />
                          <span className="font-semibold text-sm">{endpointFormData.method}</span>
                        </div>
                        <p className="font-mono text-sm break-all">
                          {project.external_api_base_url || project.external_api_url}
                          {endpointFormData.url_pattern.startsWith('/') ? '' : '/'}
                          {endpointFormData.url_pattern}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Manage API keys for this project</CardDescription>
                {endpointGroups.length === 0 && (
                  <p className="text-sm text-destructive mt-1">You must create at least one endpoint group before creating API keys.</p>
                )}
              </div>
              <Dialog open={keyDialogOpen} onOpenChange={(o) => {
                setKeyDialogOpen(o);
                if (!o) {
                  setEditingKey(null);
                  setOriginalKeyFormData(null);
                  setExpirySettingsOpen(false);
                  setHasAttemptedSave(false);
                  setRestrictionType('none');
                  setKeyFormData({
                    name: '',
                    rate_limit_id: '',
                    ip_blocklist_id: '',
                    ip_allowlist_id: '',
                    user_id: '',
                    notes: '',
                    allowed_methods: [],
                    allowed_endpoint_group_ids: [],
                    expiry_date: '',
                    expiry_time: '',
                    expiry_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    expiry_usage_limit: '',
                    expiry_response_code: 403,
                    expiry_response_body: '{"error": "API key expired"}',
                    expiry_response_type: 'json',
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button disabled={endpointGroups.length === 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    New API Key
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingKey ? 'Edit' : 'Create'} API Key</DialogTitle>
                  </DialogHeader>
                  <div className="absolute right-4 top-12 z-10">
                    <Button type="submit" form="key-form" disabled={!hasFormChanges}>Save</Button>
                  </div>
                  <form id="key-form" onSubmit={handleKeySubmit}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="key-name">Name *</Label>
                        <Input
                          id="key-name"
                          value={keyFormData.name}
                          onChange={(e) => setKeyFormData({ ...keyFormData, name: e.target.value })}
                          placeholder="API key name"
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">Must be unique</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label>Rate Limit *</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Select a rate limit configuration that will be applied to this API key. 
                                  The rate limit defines how many requests can be made within specific time windows.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <Select
                              value={keyFormData.rate_limit_id}
                              onValueChange={(value) => setKeyFormData({ ...keyFormData, rate_limit_id: value })}
                              required
                            >
                            <SelectTrigger>
                              <SelectValue placeholder="Select rate limit" />
                            </SelectTrigger>
                            <SelectContent>
                              {rateLimits.map((rl) => (
                                <SelectItem key={rl.id} value={rl.id.toString()}>
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="font-medium">{rl.name}</span>
                                    {rl.rules && rl.rules.length > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {rl.rules.slice(0, 2).map((rule: any, idx: number) => (
                                          <span key={idx}>
                                            {rule.requests}/{rule.window_seconds}s{idx < Math.min(rl.rules.length - 1, 1) ? ', ' : ''}
                                          </span>
                                        ))}
                                        {rl.rules.length > 2 && '...'}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          </div>
                          {keyFormData.rate_limit_id && (() => {
                            const rl = rateLimits.find((rl) => rl.id.toString() === keyFormData.rate_limit_id);
                            if (!rl) return null;
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-2">
                                      <p className="font-semibold">{rl.name}</p>
                                      {rl.rules && rl.rules.length > 0 && (
                                        <div>
                                          <p className="text-xs font-medium mb-1">Rules:</p>
                                          <ul className="text-xs space-y-1">
                                            {rl.rules.map((rule: any, idx: number) => (
                                              <li key={idx}>{rule.requests} requests every {rule.window_seconds} seconds</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      <div className="text-xs">
                                        <p>Response Code: {rl.response_code}</p>
                                        <p>Response Type: {(rl.response_type || 'json').toUpperCase()}</p>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label>Restriction Type</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Choose either an IP blocklist (block specific IPs) or an IP allowlist (only allow specific IPs). 
                                  You can only use one at a time.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                value={restrictionType}
                                onValueChange={(value: 'none' | 'blocklist' | 'allowlist') => {
                                  setRestrictionType(value);
                                  if (value === 'none') {
                                    setKeyFormData({ ...keyFormData, ip_blocklist_id: '', ip_allowlist_id: '' });
                                  } else if (value === 'blocklist') {
                                    setKeyFormData({ ...keyFormData, ip_blocklist_id: '', ip_allowlist_id: '' });
                                  } else if (value === 'allowlist') {
                                    setKeyFormData({ ...keyFormData, ip_allowlist_id: '', ip_blocklist_id: '' });
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="blocklist">IP Blocklist</SelectItem>
                                  <SelectItem value="allowlist">IP Allowlist</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {restrictionType === 'blocklist' && (
                            <>
                              <div>
                                <Label className="text-sm">
                                  Blacklist Rule *
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Select
                                    value={keyFormData.ip_blocklist_id || ''}
                                    onValueChange={(value) => setKeyFormData({ ...keyFormData, ip_blocklist_id: value, ip_allowlist_id: '' })}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select blocklist" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ipBlocklists.map((bl) => (
                                        <SelectItem key={bl.id} value={bl.id.toString()}>
                                          <div className="flex items-center gap-2 w-full">
                                            <Shield className="h-4 w-4" />
                                            <span className="font-medium">{bl.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {bl.ips ? `${bl.ips.split('\n').length} IP(s)` : '0 IPs'} • {bl.response_code}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {keyFormData.ip_blocklist_id && (() => {
                                  const bl = ipBlocklists.find((bl) => bl.id.toString() === keyFormData.ip_blocklist_id);
                                  if (!bl) return null;
                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-2">
                                            <p className="font-semibold">{bl.name}</p>
                                            <div className="text-xs">
                                              <p>IPs: {bl.ips ? bl.ips.split('\n').length : 0}</p>
                                              <p>Response Code: {bl.response_code}</p>
                                              <p>Response Type: {(bl.response_type || 'json').toUpperCase()}</p>
                                            </div>
                                            {bl.ips && (
                                              <div>
                                                <p className="text-xs font-medium mb-1">IP Addresses:</p>
                                                <pre className="text-xs bg-muted p-2 rounded max-h-32 overflow-auto">{bl.ips}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}
                              </div>
                            </>
                          )}
                          {restrictionType === 'allowlist' && (
                            <>
                              <div>
                                <Label className="text-sm">
                                  Whitelist Rule *
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <Select
                                    value={keyFormData.ip_allowlist_id || ''}
                                    onValueChange={(value) => setKeyFormData({ ...keyFormData, ip_allowlist_id: value, ip_blocklist_id: '' })}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select allowlist" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ipAllowlists.map((al) => (
                                        <SelectItem key={al.id} value={al.id.toString()}>
                                          <div className="flex items-center gap-2 w-full">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span className="font-medium">{al.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {al.ips ? `${al.ips.split('\n').length} IP(s)` : '0 IPs'} • {al.response_code}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {keyFormData.ip_allowlist_id && (() => {
                                  const al = ipAllowlists.find((al) => al.id.toString() === keyFormData.ip_allowlist_id);
                                  if (!al) return null;
                                  return (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <div className="space-y-2">
                                            <p className="font-semibold">{al.name}</p>
                                            <div className="text-xs">
                                              <p>IPs: {al.ips ? al.ips.split('\n').length : 0}</p>
                                              <p>Response Code: {al.response_code}</p>
                                              <p>Response Type: {(al.response_type || 'json').toUpperCase()}</p>
                                            </div>
                                            {al.ips && (
                                              <div>
                                                <p className="text-xs font-medium mb-1">IP Addresses:</p>
                                                <pre className="text-xs bg-muted p-2 rounded max-h-32 overflow-auto">{al.ips}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label>User</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Select a user to associate with this API key. Users can be created in the Users page.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Select
                          value={keyFormData.user_id || 'none'}
                          onValueChange={(value) => setKeyFormData({ ...keyFormData, user_id: value === 'none' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                <div className="flex items-center gap-2 w-full">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: user.color || '#3b82f6' }}
                                  />
                                  <span className="font-medium">{user.first_name} {user.last_name}</span>
                                  {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label>Allowed Methods *</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Select which HTTP methods this API key can use. At least one method must be selected.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {hasAttemptedSave && keyFormData.allowed_methods.length === 0 && (
                          <p className="text-xs text-destructive mt-1">At least one method must be selected</p>
                        )}
                        <div className="space-y-2 mt-2">
                          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => {
                            const methodColors: Record<string, string> = {
                              'GET': '#10b981',
                              'POST': '#3b82f6',
                              'PUT': '#f59e0b',
                              'PATCH': '#8b5cf6',
                              'DELETE': '#ef4444'
                            };
                            return (
                              <label key={method} className="flex items-center space-x-2 cursor-pointer">
                                <Checkbox
                                  checked={keyFormData.allowed_methods.includes(method)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setKeyFormData({
                                        ...keyFormData,
                                        allowed_methods: [...keyFormData.allowed_methods, method],
                                      });
                                    } else {
                                      setKeyFormData({
                                        ...keyFormData,
                                        allowed_methods: keyFormData.allowed_methods.filter((m) => m !== method),
                                      });
                                    }
                                  }}
                                />
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: methodColors[method] }}
                                  />
                                  <span>{method}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label>Allowed Endpoint Groups *</Label>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Select which endpoint groups this API key can access. At least one group must be selected.
                                  This works in combination with allowed methods.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {hasAttemptedSave && keyFormData.allowed_endpoint_group_ids.length === 0 && (
                          <p className="text-xs text-destructive mt-1">At least one endpoint group must be selected</p>
                        )}
                        <div className="space-y-2 mt-2">
                          {[...endpointGroups].sort((a, b) => {
                            const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                            const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                            return aDate - bDate;
                          }).map((group, index) => (
                            <TooltipProvider key={group.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <label className="flex items-center space-x-2 cursor-pointer">
                                    <Checkbox
                                      checked={keyFormData.allowed_endpoint_group_ids.includes(group.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setKeyFormData({
                                            ...keyFormData,
                                            allowed_endpoint_group_ids: [...keyFormData.allowed_endpoint_group_ids, group.id],
                                          });
                                        } else {
                                          setKeyFormData({
                                            ...keyFormData,
                                            allowed_endpoint_group_ids: keyFormData.allowed_endpoint_group_ids.filter((id) => id !== group.id),
                                          });
                                        }
                                      }}
                                    />
                                    <span>{index + 1}. {group.name}</span>
                                  </label>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-sm" sideOffset={5}>
                                  <div className="space-y-2">
                                    <p className="font-semibold">{group.name}</p>
                                    {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
                                    {group.endpoints && group.endpoints.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium mb-1">Endpoints:</p>
                                        <ul className="text-xs space-y-1">
                                          {group.endpoints.map((endpoint: any, idx: number) => {
                                            const methodColors: Record<string, string> = {
                                              'GET': '#10b981',
                                              'POST': '#3b82f6',
                                              'PUT': '#f59e0b',
                                              'PATCH': '#8b5cf6',
                                              'DELETE': '#ef4444'
                                            };
                                            return (
                                              <li key={idx} className="flex items-center gap-2">
                                                <div
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: methodColors[endpoint.method] || '#6b7280' }}
                                                />
                                                <span className="font-mono">{endpoint.method} {endpoint.url_pattern}</span>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <Textarea
                          value={keyFormData.notes}
                          onChange={(e) => setKeyFormData({ ...keyFormData, notes: e.target.value })}
                        />
                      </div>
                      <div className="border-t pt-4">
                        <button
                          type="button"
                          onClick={() => setExpirySettingsOpen(!expirySettingsOpen)}
                          className="flex items-center justify-between w-full text-left hover:bg-muted/50 p-2 rounded-md transition-colors"
                        >
                          <div>
                            <Label className="text-base font-semibold cursor-pointer">Expiry Settings</Label>
                            <p className="text-xs text-muted-foreground">Configure when this API key should expire</p>
                          </div>
                          {expirySettingsOpen ? (
                            <ChevronDown className="h-4 w-4 transition-transform" />
                          ) : (
                            <ChevronRight className="h-4 w-4 transition-transform" />
                          )}
                        </button>
                        
                        {expirySettingsOpen && (
                          <div className="mt-4 space-y-4">
                            {((keyFormData.expiry_date && keyFormData.expiry_time) || keyFormData.expiry_usage_limit) && (
                              <div className="flex items-center justify-between bg-muted p-3 rounded-md">
                                {(keyFormData.expiry_date && keyFormData.expiry_time) && (() => {
                                  try {
                                    // Parse date/time components
                                    const [year, month, day] = keyFormData.expiry_date.split('-').map(Number);
                                    const [hours, minutes] = keyFormData.expiry_time.split(':').map(Number);
                                    
                                    // Create a function to convert date/time in a specific timezone to UTC Date
                                    // We'll use an iterative approach to find the correct UTC time
                                    const convertToUTC = (y: number, m: number, d: number, h: number, min: number, tz: string): Date => {
                                      // Start with a guess: create date as if it's UTC
                                      let guess = new Date(Date.UTC(y, m - 1, d, h, min, 0));
                                      
                                      // Format this guess in the target timezone
                                      const formatter = new Intl.DateTimeFormat('en-US', {
                                        timeZone: tz,
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                      });
                                      
                                      // Get what time this represents in the target timezone
                                      const formatted = formatter.format(guess);
                                      const match = formatted.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
                                      
                                      if (match) {
                                        const [, fMonth, fDay, fYear, fHour, fMin] = match.map(Number);
                                        
                                        // Calculate difference in minutes
                                        const targetMinutes = h * 60 + min;
                                        const actualMinutes = fHour * 60 + fMin;
                                        const diffMinutes = targetMinutes - actualMinutes;
                                        
                                        // Adjust the guess
                                        guess = new Date(guess.getTime() + diffMinutes * 60 * 1000);
                                        
                                        // Verify and fine-tune if needed (one more iteration for accuracy)
                                        const formatted2 = formatter.format(guess);
                                        const match2 = formatted2.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+)/);
                                        if (match2) {
                                          const [, , , , fHour2, fMin2] = match2.map(Number);
                                          const actualMinutes2 = fHour2 * 60 + fMin2;
                                          const diffMinutes2 = targetMinutes - actualMinutes2;
                                          if (Math.abs(diffMinutes2) > 0) {
                                            guess = new Date(guess.getTime() + diffMinutes2 * 60 * 1000);
                                          }
                                        }
                                      }
                                      
                                      return guess;
                                    };
                                    
                                    // Convert the expiry date/time (in expiry timezone) to UTC
                                    const actualExpiryUTC = convertToUTC(year, month, day, hours, minutes, keyFormData.expiry_timezone);
                                    
                                    // Format time in user's timezone
                                    const userFormatter = new Intl.DateTimeFormat('en-US', {
                                      timeZone: userTimezone,
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: true,
                                    });
                                    const formattedTimeInUserTZ = userFormatter.format(actualExpiryUTC);
                                    
                                    // Calculate relative time
                                    const now = new Date();
                                    const isExpired = actualExpiryUTC < now;
                                    const diff = Math.abs(now.getTime() - actualExpiryUTC.getTime());
                                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    const hoursDiff = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                    const minutesDiff = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    
                                    let relativeTime = '';
                                    if (isExpired) {
                                      relativeTime = `Expired ${days > 0 ? `${days}d ` : ''}${hoursDiff > 0 ? `${hoursDiff}h ` : ''}${minutesDiff > 0 ? `${minutesDiff}m ` : ''}ago`.trim();
                                    } else {
                                      relativeTime = `Expires in ${days > 0 ? `${days}d ` : ''}${hoursDiff > 0 ? `${hoursDiff}h ` : ''}${minutesDiff > 0 ? `${minutesDiff}m` : ''}`.trim();
                                    }
                                    
                                    return (
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium">Preview Expiry</p>
                                        <div className="text-xs space-y-1">
                                          <p className={isExpired ? 'text-destructive' : ''}>
                                            <span className="font-medium">Relative:</span> {relativeTime}
                                          </p>
                                          <p>
                                            <span className="font-medium">Time ({userTimezone}):</span> {formattedTimeInUserTZ}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  } catch (e) {
                                    return null;
                                  }
                                })()}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setKeyFormData({
                                      ...keyFormData,
                                      expiry_date: '',
                                      expiry_time: '',
                                      expiry_usage_limit: '',
                                    });
                                  }}
                                >
                                  Clear Expiry
                                </Button>
                              </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Expiry Date {keyFormData.expiry_time && <span className="text-destructive">*</span>}</Label>
                            <Input
                              type="date"
                              value={keyFormData.expiry_date}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setKeyFormData({ 
                                  ...keyFormData, 
                                  expiry_date: newDate,
                                  expiry_time: newDate && !keyFormData.expiry_time ? '00:00' : keyFormData.expiry_time
                                });
                              }}
                              required={!!keyFormData.expiry_time}
                            />
                          </div>
                          <div>
                            <Label>Expiry Time {keyFormData.expiry_date && <span className="text-destructive">*</span>}</Label>
                            <Input
                              type="time"
                              value={keyFormData.expiry_time}
                              onChange={(e) => {
                                const newTime = e.target.value;
                                setKeyFormData({ 
                                  ...keyFormData, 
                                  expiry_time: newTime,
                                  expiry_date: newTime && !keyFormData.expiry_date ? new Date().toISOString().split('T')[0] : keyFormData.expiry_date
                                });
                              }}
                              required={!!keyFormData.expiry_date}
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Timezone</Label>
                          <Select
                            value={keyFormData.expiry_timezone}
                            onValueChange={(value) => setKeyFormData({ ...keyFormData, expiry_timezone: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timezones.map((tz) => (
                                <SelectItem key={tz} value={tz}>
                                  {tz}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentTimezoneTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Current time in {keyFormData.expiry_timezone}: {currentTimezoneTime}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Usage Limit</Label>
                          <Input
                            type="number"
                            value={keyFormData.expiry_usage_limit}
                            onChange={(e) => setKeyFormData({ ...keyFormData, expiry_usage_limit: e.target.value })}
                            placeholder="Maximum number of requests"
                            min="1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            API key will expire after this many requests
                            {editingKey && editingKey.total_usage !== undefined && (
                              <span className="ml-2 font-medium">
                                (Current: {editingKey.total_usage} requests)
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <Label>Expiry Response Code</Label>
                          <Input
                            type="number"
                            value={keyFormData.expiry_response_code}
                            onChange={(e) => setKeyFormData({ ...keyFormData, expiry_response_code: parseInt(e.target.value) })}
                            min="100"
                            max="599"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Label>Expiry Response Type</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">The content type of the response body when the API key expires.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Select
                            value={keyFormData.expiry_response_type}
                            onValueChange={(value) => setKeyFormData({ ...keyFormData, expiry_response_type: value })}
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
                          <Label>Expiry Response Body</Label>
                          <Textarea
                            value={keyFormData.expiry_response_body}
                            onChange={(e) => setKeyFormData({ ...keyFormData, expiry_response_body: e.target.value })}
                            rows={3}
                          />
                        </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={!hasFormChanges}>Save</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Rate Limit</TableHead>
                  <TableHead>Endpoint Groups</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Total Usage</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => {
                  // Sort endpoint groups by created_at for numbering
                  const sortedGroups = [...(key.allowed_endpoint_groups || [])].sort((a: any, b: any) => {
                    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return aDate - bDate;
                  });
                  
                  // Get all endpoint groups sorted for numbering
                  const allGroupsSorted = [...endpointGroups].sort((a, b) => {
                    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return aDate - bDate;
                  });
                  
                  return (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{key.name || 'Unnamed'}</div>
                        {key.ip_allowlist_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This API key uses an IP allowlist (whitelist)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {key.ip_blocklist_id && !key.ip_allowlist_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Shield className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>This API key uses an IP blocklist</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.user ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: key.user.color || '#3b82f6' }}
                          />
                          <div>
                            <div>{key.user.first_name} {key.user.last_name}</div>
                            {key.user.email && <div className="text-xs text-muted-foreground">{key.user.email}</div>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No user</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rateLimits.find((rl) => rl.id === key.rate_limit_id)?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {key.allowed_endpoint_groups && key.allowed_endpoint_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {sortedGroups.map((eg: any) => {
                            const groupIndex = allGroupsSorted.findIndex(g => g.id === eg.id) + 1;
                            return (
                              <span key={eg.id} className="text-xs bg-muted px-2 py-1 rounded">
                                {groupIndex}. {eg.name}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">All groups</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {key.created_at ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-sm">{formatRelativeTime(key.created_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{new Date(key.created_at).toLocaleString()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-xs">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {key.last_used ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-sm">{formatRelativeTime(key.last_used)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{new Date(key.last_used).toLocaleString()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-xs">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{key.total_usage || 0}</span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const hasDateExpiry = key.expiry_date;
                        const hasUsageExpiry = key.expiry_usage_limit;
                        const currentUsage = key.total_usage || 0;
                        
                        if (!hasDateExpiry && !hasUsageExpiry) {
                          return <span className="text-muted-foreground text-xs">No expiry</span>;
                        }
                        
                        return (
                          <div className="space-y-1 text-xs">
                            {hasDateExpiry && (() => {
                              const expiryDate = new Date(key.expiry_date);
                              const now = new Date();
                              const isExpired = expiryDate < now;
                              const diff = Math.abs(now.getTime() - expiryDate.getTime());
                              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                              const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                              
                              let relativeTime = '';
                              if (isExpired) {
                                relativeTime = `Expired ${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h ` : ''}${minutes}m ago`;
                              } else {
                                relativeTime = `In ${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
                              }
                              
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className={isExpired ? 'text-destructive cursor-help' : 'cursor-help'}>
                                        {relativeTime}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{expiryDate.toLocaleString()}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                            {hasUsageExpiry && (
                              <p className={currentUsage >= (key.expiry_usage_limit || 0) ? 'text-destructive' : ''}>
                                {currentUsage} / {key.expiry_usage_limit} requests
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(key.key_value);
                                  toast({
                                    title: 'Copied',
                                    description: 'API key copied to clipboard',
                                  });
                                }}
                              >
                                <Key className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy API key</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => {
                                setEditingKey(key);
                                // Parse expiry_date to date and time
                                let expiry_date = '';
                                let expiry_time = '';
                                if (key.expiry_date) {
                                  const date = new Date(key.expiry_date);
                                  expiry_date = date.toISOString().split('T')[0];
                                  expiry_time = date.toTimeString().split(' ')[0].substring(0, 5);
                                }
                                const formData = {
                                  name: key.name || '',
                                  rate_limit_id: key.rate_limit_id?.toString() || '',
                                  ip_blocklist_id: key.ip_blocklist_id?.toString() || '',
                                  ip_allowlist_id: key.ip_allowlist_id?.toString() || '',
                                  user_id: key.user_id?.toString() || '',
                                  notes: key.notes || '',
                                  allowed_methods: key.allowed_methods ? (typeof key.allowed_methods === 'string' ? key.allowed_methods.split(',') : key.allowed_methods) : [],
                                  allowed_endpoint_group_ids: key.allowed_endpoint_groups?.map((eg: any) => eg.id) || [],
                                  expiry_date: expiry_date,
                                  expiry_time: expiry_time,
                                  expiry_timezone: key.expiry_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                                  expiry_usage_limit: key.expiry_usage_limit?.toString() || '',
                                  expiry_response_code: key.expiry_response_code || 403,
                                  expiry_response_body: key.expiry_response_body || '{"error": "API key expired"}',
                                  expiry_response_type: key.expiry_response_type || 'json',
                                };
                                setKeyFormData(formData);
                                setOriginalKeyFormData(JSON.parse(JSON.stringify(formData))); // Deep copy
                                setRestrictionType(key.ip_blocklist_id ? 'blocklist' : key.ip_allowlist_id ? 'allowlist' : 'none');
                                setExpirySettingsOpen(!!(key.expiry_date || key.expiry_usage_limit));
                                setKeyDialogOpen(true);
                              }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit this API key</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => handleRotateKey(key.id)}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Rotate this API key</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteKey(key.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Delete this API key</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Delete Key Confirmation Dialog */}
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
            <AlertDialogAction onClick={confirmDeleteKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotate Key Confirmation Dialog */}
      <AlertDialog open={rotateKeyDialogOpen} onOpenChange={setRotateKeyDialogOpen}>
        <AlertDialogContent onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to rotate this API key? The old key will be invalidated and a new key will be generated. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRotateKey}>Rotate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={deleteGroupDialogOpen} onOpenChange={(open) => {
        setDeleteGroupDialogOpen(open);
        if (!open) {
          setDeleteGroupTarget(null);
          setDeleteGroupAssociatedKeys([]);
        }
      }}>
        <AlertDialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint Group</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteGroupAssociatedKeys.length > 0 ? (
                <div className="space-y-4 mt-4">
                  <p className="text-destructive font-medium">
                    Cannot delete: {deleteGroupAssociatedKeys.length} API key(s) are using this endpoint group.
                  </p>
                  <p className="text-sm">Please delete the following API keys first:</p>
                  <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                    {deleteGroupAssociatedKeys.map((key: any) => (
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
                  {deleteGroupAssociatedKeys.length === 0 && deleteGroupTarget && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm mb-2">All associated API keys have been deleted. You can now delete this endpoint group.</p>
                      <Button
                        variant="destructive"
                        onClick={confirmDeleteGroup}
                      >
                        Delete Endpoint Group
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p>Are you sure you want to delete this endpoint group? This action cannot be undone.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteGroupAssociatedKeys.length === 0 && (
              <AlertDialogAction onClick={confirmDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Associated Key Confirmation Dialog */}
      <AlertDialog open={deleteGroupKeyDialogOpen} onOpenChange={setDeleteGroupKeyDialogOpen}>
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

      {/* Delete Endpoint Confirmation Dialog */}
      <AlertDialog open={deleteEndpointDialogOpen} onOpenChange={setDeleteEndpointDialogOpen}>
        <AlertDialogContent onInteractOutside={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this endpoint? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEndpoint} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
