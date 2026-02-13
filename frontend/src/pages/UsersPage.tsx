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
import { Plus, Edit, Trash2, HelpCircle, Users, Key, Shield, BarChart3 } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    color: '#3b82f6',
    notes: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteAssociatedKeys, setDeleteAssociatedKeys] = useState<any[]>([]);
  const [deleteKeyDialogOpen, setDeleteKeyDialogOpen] = useState(false);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState<number | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, formData);
      } else {
        await api.post('/users', formData);
      }
      setOpen(false);
      setEditing(null);
      setFormData({ first_name: '', last_name: '', email: '', color: '#3b82f6', notes: '' });
      loadUsers();
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to save user');
      setErrorDialogOpen(true);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTarget(id);
    try {
      // Check for associated keys before showing dialog
      const res = await api.get(`/users/${id}/associated-keys`);
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
      await api.delete(`/users/${deleteTarget}`);
      loadUsers();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setDeleteAssociatedKeys([]);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.associated_keys) {
        setDeleteAssociatedKeys(error.response.data.associated_keys);
      } else {
        setErrorMessage(error.response?.data?.error || 'Failed to delete user');
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

  const handleEdit = (user: any) => {
    setEditing(user);
    setFormData({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || '',
      color: user.color || '#3b82f6',
      notes: user.notes || '',
    });
    setOpen(true);
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Users</h2>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setFormData({ first_name: '', last_name: '', email: '', color: '#3b82f6', notes: '' });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit' : 'Create'} User</DialogTitle>
              <DialogDescription>
                Create a user that can be assigned to API keys
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="color">Color</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Choose a color to identify this user. This color will be shown next to the user's name in API key selections.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

      {!loading && users.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Organize Your API Users</CardTitle>
              <CardDescription className="mb-4">
                Create user profiles to assign to API keys. This helps you track and manage who has access to your APIs.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Key className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Assign Keys to Users</CardTitle>
              <CardDescription className="mb-4">
                Link API keys to specific users to better manage access control and track usage per user.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Enhanced Security</CardTitle>
              <CardDescription className="mb-4">
                User-based access control allows you to quickly revoke access by user and monitor individual activity.
              </CardDescription>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
              <CardTitle className="mb-2">Track Usage by User</CardTitle>
              <CardDescription className="mb-4">
                Monitor API usage patterns per user to understand how different users interact with your services.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: user.color || '#3b82f6' }}
                  />
                  <div>
                    <CardTitle>{user.first_name} {user.last_name}</CardTitle>
                    {user.email && (
                      <CardDescription>{user.email}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit user</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete user</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardHeader>
            {user.notes && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{user.notes}</p>
              </CardContent>
            )}
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
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAssociatedKeys.length > 0 ? (
                <div className="space-y-4 mt-4">
                  <p className="text-destructive font-medium">
                    Cannot delete: {deleteAssociatedKeys.length} API key(s) are using this user.
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
                      <p className="text-sm mb-2">All associated API keys have been deleted. You can now delete this user.</p>
                      <Button
                        variant="destructive"
                        onClick={confirmDelete}
                      >
                        Delete User
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p>Are you sure you want to delete this user? This action cannot be undone.</p>
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
