import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { setCurrentAccount, getCurrentAccount } from '@/lib/auth';
import { LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    // Redirect if already logged in
    const account = getCurrentAccount();
    if (account) {
      navigate('/', { replace: true });
    }
  }, [navigate]);
  const [isLogin, setIsLogin] = useState(true);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    two_factor_code: '',
  });
  const [signupForm, setSignupForm] = useState({
    username: '',
    password: '',
    confirm_password: '',
  });
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await api.post('/auth/login', {
        username: loginForm.username,
        password: loginForm.password,
        two_factor_code: loginForm.two_factor_code || undefined,
      });
      
      if (res.data.requires_2fa) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }
      
      // Store account info
      setCurrentAccount({
        id: res.data.account.id,
        username: res.data.account.username,
        two_factor_enabled: res.data.account.two_factor_enabled,
        session_timeout_seconds: res.data.account.session_timeout_seconds,
      });
      
      // Store session start time
      localStorage.setItem('key-session-start-time', Date.now().toString());
      
      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
      
      navigate('/');
    } catch (error: any) {
      if (error.response?.data?.requires_2fa) {
        setRequires2FA(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.response?.data?.error || 'Failed to login',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupForm.password !== signupForm.confirm_password) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Passwords do not match',
      });
      return;
    }
    
    if (signupForm.username.length < 3) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Username must be at least 3 characters long',
      });
      return;
    }
    
    if (signupForm.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Password must be at least 8 characters long',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await api.post('/auth/signup', {
        username: signupForm.username,
        password: signupForm.password,
      });
      
      toast({
        title: 'Success',
        description: 'Account created successfully. Please login.',
      });
      
      // Switch to login tab and pre-fill username
      setIsLogin(true);
      setLoginForm({
        username: signupForm.username,
        password: '',
        two_factor_code: '',
      });
      setSignupForm({
        username: '',
        password: '',
        confirm_password: '',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create account',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">KeySplitter</CardTitle>
          <CardDescription>API Gateway Management</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(v) => {
            setIsLogin(v === 'login');
            setRequires2FA(false);
            setLoginForm({ username: loginForm.username, password: '', two_factor_code: '' });
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </TabsTrigger>
              <TabsTrigger value="signup">
                <UserPlus className="h-4 w-4 mr-2" />
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-username">Username *</Label>
                  <Input
                    id="login-username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Password *</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
                {requires2FA && (
                  <div>
                    <Label htmlFor="login-2fa">Two-Factor Authentication Code *</Label>
                    <Input
                      id="login-2fa"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={loginForm.two_factor_code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setLoginForm({ ...loginForm, two_factor_code: value });
                      }}
                      placeholder="000000"
                      className="text-center text-2xl font-mono tracking-widest"
                      required
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Loading...' : 'Login'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="signup-username">Username *</Label>
                  <Input
                    id="signup-username"
                    value={signupForm.username}
                    onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                    required
                    minLength={3}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be at least 3 characters long
                  </p>
                </div>
                <div>
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    required
                    minLength={8}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Must be at least 8 characters long
                  </p>
                </div>
                <div>
                  <Label htmlFor="signup-confirm">Confirm Password *</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    value={signupForm.confirm_password}
                    onChange={(e) => setSignupForm({ ...signupForm, confirm_password: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Creating...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
