import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldCheck, 
  Activity,
  Calendar,
  Mail,
  Phone,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const limit = 20;

  // Fetch users
  const usersQuery = trpc.admin.getUsers.useQuery({
    search: search || undefined,
    role: roleFilter,
    limit,
    offset: page * limit,
  });

  // Fetch user details when selected
  const userDetailsQuery = trpc.admin.getUserDetails.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  // Toggle admin mutation
  const toggleAdminMutation = trpc.admin.toggleUserAdmin.useMutation({
    onSuccess: () => {
      toast.success('User permissions have been updated successfully.');
      usersQuery.refetch();
      if (selectedUserId) {
        userDetailsQuery.refetch();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleToggleAdmin = (userId: number, currentRole: string) => {
    toggleAdminMutation.mutate({
      userId,
      makeAdmin: currentRole !== 'admin',
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil((usersQuery.data?.total || 0) / limit);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  ← Back to Admin
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  User Management
                </h1>
                <p className="text-sm text-slate-500">
                  {usersQuery.data?.total || 0} total users
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  className="pl-10"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(value: 'all' | 'user' | 'admin') => {
                  setRoleFilter(value);
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="user">Regular Users</SelectItem>
                  <SelectItem value="admin">Admins Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {usersQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : usersQuery.data?.users.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Today's Usage</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersQuery.data?.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">
                            {user.name || 'Unnamed User'}
                          </p>
                          <p className="text-xs text-slate-500">ID: {user.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.email && (
                            <p className="text-sm text-slate-600 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          )}
                          {user.phone && (
                            <p className="text-sm text-slate-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {user.phone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.role === 'admin' ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Shield className="w-3 h-3 mr-1" />
                            User
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="text-slate-600">
                            {user.usageToday?.propertyAnalyses || 0} analyses
                          </p>
                          <p className="text-slate-400 text-xs">
                            {user.usageToday?.marketResearches || 0} market searches
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-600">
                          {formatDate(user.lastSignedIn)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUserId(user.id)}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Admin</span>
                            <Switch
                              checked={user.role === 'admin'}
                              onCheckedChange={() => handleToggleAdmin(user.id, user.role)}
                              disabled={toggleAdminMutation.isPending}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-slate-500">
                Showing {page * limit + 1} - {Math.min((page + 1) * limit, usersQuery.data?.total || 0)} of {usersQuery.data?.total || 0}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* User Details Dialog */}
      <Dialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Details
            </DialogTitle>
            <DialogDescription>
              View user information and usage history
            </DialogDescription>
          </DialogHeader>

          {userDetailsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : userDetailsQuery.data ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Name</p>
                  <p className="font-medium">{userDetailsQuery.data.user.name || 'Unnamed'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Email</p>
                  <p className="font-medium">{userDetailsQuery.data.user.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Role</p>
                  <div className="flex items-center gap-2">
                    {userDetailsQuery.data.user.role === 'admin' ? (
                      <Badge className="bg-amber-100 text-amber-800">Admin</Badge>
                    ) : (
                      <Badge variant="secondary">User</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleAdmin(
                        userDetailsQuery.data!.user.id,
                        userDetailsQuery.data!.user.role
                      )}
                      disabled={toggleAdminMutation.isPending}
                    >
                      {userDetailsQuery.data.user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Member Since</p>
                  <p className="font-medium">{formatDate(userDetailsQuery.data.user.createdAt)}</p>
                </div>
              </div>

              {/* Usage Stats */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Usage Summary (Last 30 Days)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold text-slate-900">
                        {userDetailsQuery.data.totals.analyses}
                      </p>
                      <p className="text-sm text-slate-500">Property Analyses</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold text-slate-900">
                        {userDetailsQuery.data.totals.marketResearches}
                      </p>
                      <p className="text-sm text-slate-500">Market Searches</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-2xl font-bold text-slate-900">
                        {userDetailsQuery.data.totals.apiCalls}
                      </p>
                      <p className="text-sm text-slate-500">API Calls</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Recent Usage */}
              {userDetailsQuery.data.usageHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Recent Activity
                  </h3>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Analyses</TableHead>
                          <TableHead>Markets</TableHead>
                          <TableHead>API Calls</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userDetailsQuery.data.usageHistory.map((usage) => (
                          <TableRow key={usage.date}>
                            <TableCell>{usage.date}</TableCell>
                            <TableCell>{usage.propertyAnalyses}</TableCell>
                            <TableCell>{usage.marketResearches}</TableCell>
                            <TableCell>{usage.apiCallsCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
