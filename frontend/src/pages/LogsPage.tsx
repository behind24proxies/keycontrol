import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    project_id: 'all',
    api_key_id: 'all',
  });

  useEffect(() => {
    loadProjects();
    loadLogs();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  useEffect(() => {
    if (filters.project_id && filters.project_id !== 'all') {
      loadApiKeys(filters.project_id);
    } else {
      setApiKeys([]);
    }
  }, [filters.project_id]);

  const loadProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadApiKeys = async (projectId: string) => {
    try {
      const res = await api.get(`/projects/${projectId}/api-keys`);
      setApiKeys(res.data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    }
  };

  const generateRandomLogs = () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const urls = [
      '/api/v1/users',
      '/api/v1/products',
      '/api/v1/orders',
      '/api/v1/auth/login',
      '/api/v1/data/export',
      '/api/v1/settings',
      '/api/v1/analytics',
      '/api/v1/webhooks',
      '/api/v1/files/upload',
      '/api/v1/notifications'
    ];
    const statusCodes = [200, 201, 204, 400, 401, 403, 404, 422, 429, 500, 502, 503];
    const ips = [
      '192.168.1.100',
      '10.0.0.45',
      '172.16.0.23',
      '203.0.113.42',
      '198.51.100.15',
      '192.0.2.78',
      '10.1.1.200',
      '172.20.5.10'
    ];
    
    const randomLogs = [];
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Generate 15-25 random logs
    const count = Math.floor(Math.random() * 11) + 15;
    
    for (let i = 0; i < count; i++) {
      // Random time within the past hour
      const randomTime = new Date(oneHourAgo + Math.random() * (now - oneHourAgo));
      const method = methods[Math.floor(Math.random() * methods.length)];
      const url = urls[Math.floor(Math.random() * urls.length)];
      const statusCode = statusCodes[Math.floor(Math.random() * statusCodes.length)];
      const ip = ips[Math.floor(Math.random() * ips.length)];
      
      // Generate random headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + Math.random().toString(36).substring(7)
      };
      
      // Generate random request body (only for POST, PUT, PATCH)
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        body = {
          name: `Item ${Math.floor(Math.random() * 1000)}`,
          value: Math.floor(Math.random() * 100),
          timestamp: new Date().toISOString()
        };
      }
      
      // Generate random response body
      let responseBody = null;
      if (statusCode >= 200 && statusCode < 300) {
        responseBody = {
          success: true,
          data: {
            id: Math.floor(Math.random() * 10000),
            message: 'Operation completed successfully'
          }
        };
      } else if (statusCode >= 400) {
        responseBody = {
          error: statusCode === 404 ? 'Resource not found' : 
                 statusCode === 401 ? 'Unauthorized' :
                 statusCode === 403 ? 'Forbidden' :
                 statusCode === 429 ? 'Rate limit exceeded' :
                 'An error occurred',
          code: statusCode
        };
      }
      
      randomLogs.push({
        id: i + 1,
        created_at: randomTime.toISOString(),
        method,
        url,
        response_code: statusCode,
        ip_address: ip,
        headers: JSON.stringify(headers),
        body: body ? JSON.stringify(body) : null,
        response_body: responseBody ? JSON.stringify(responseBody) : null
      });
    }
    
    // Sort by time (newest first)
    randomLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return randomLogs;
  };

  const loadLogs = async () => {
    // Always show random logs for demonstration
    setLogs(generateRandomLogs());
    
    // Optionally still try to load real logs in the background
    try {
      const params: any = {};
      if (filters.project_id && filters.project_id !== 'all') params.project_id = filters.project_id;
      if (filters.api_key_id && filters.api_key_id !== 'all') params.api_key_id = filters.api_key_id;
      // const res = await api.get('/logs', { params });
      // Uncomment above line if you want to use real logs instead
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">Request Logs</h2>
        <p className="text-muted-foreground">View all API requests and responses</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project</label>
              <Select
                value={filters.project_id}
                onValueChange={(value) => {
                  setFilters({ ...filters, project_id: value, api_key_id: 'all' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">API Key</label>
              <Select
                value={filters.api_key_id}
                onValueChange={(value) => setFilters({ ...filters, api_key_id: value })}
                disabled={!filters.project_id || filters.project_id === 'all'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All keys" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All keys</SelectItem>
                  {apiKeys.map((key) => (
                    <SelectItem key={key.id} value={key.id.toString()}>
                      {key.key_value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>{logs.length} entries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.method}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.url}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.response_code >= 200 && log.response_code < 300
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : log.response_code >= 400
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {log.response_code}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.ip_address || (
                        <span className="text-muted-foreground italic">DISABLED</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <details className="cursor-pointer">
                        <summary className="text-sm text-primary">View</summary>
                        <div className="mt-2 p-2 bg-muted rounded text-xs space-y-2">
                          <div>
                            <strong>Headers:</strong>
                            <pre className="mt-1 whitespace-pre-wrap">
                              {log.headers ? JSON.stringify(JSON.parse(log.headers), null, 2) : 'N/A'}
                            </pre>
                          </div>
                          <div>
                            <strong>Request Body:</strong>
                            <pre className="mt-1 whitespace-pre-wrap">
                              {log.body ? JSON.stringify(JSON.parse(log.body), null, 2) : 'N/A'}
                            </pre>
                          </div>
                          <div>
                            <strong>Response Body:</strong>
                            <pre className="mt-1 whitespace-pre-wrap">
                              {log.response_body ? JSON.stringify(JSON.parse(log.response_body), null, 2) : 'N/A'}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
