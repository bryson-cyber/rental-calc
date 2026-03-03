/**
 * Webinar Environment Tab
 * 
 * Admin tab for managing webinar/demo mode.
 * When enabled, the app serves cached data instead of making live API calls.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Radio, Trash2, MapPin, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

export function WebinarEnvTab() {
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);

  // Fetch current status
  const statusQuery = trpc.webinarEnv.getStatus.useQuery();
  const propertiesQuery = trpc.webinarEnv.listCachedProperties.useQuery();

  // Mutations
  const toggleMutation = trpc.webinarEnv.toggle.useMutation({
    onSuccess: (data) => {
      statusQuery.refetch();
      toast({
        title: data.isActive ? 'Webinar Mode Enabled' : 'Webinar Mode Disabled',
        description: data.isActive
          ? 'The app will now serve cached data. Rate limits are bypassed.'
          : 'Normal mode restored. Live API calls will be used.',
      });
      setIsToggling(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'error',
      });
      setIsToggling(false);
    },
  });

  const deleteMutation = trpc.webinarEnv.deleteCachedProperty.useMutation({
    onSuccess: () => {
      propertiesQuery.refetch();
      toast({ title: 'Property removed from cache' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'error' });
    },
  });

  const handleToggle = (enabled: boolean) => {
    setIsToggling(true);
    toggleMutation.mutate({ enabled });
  };

  const isActive = statusQuery.data?.isActive ?? false;
  const properties = propertiesQuery.data?.properties ?? [];

  const formatCurrency = (val: number | null) => {
    if (!val) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={isActive ? 'border-green-500/50 bg-green-500/5' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-green-500/20' : 'bg-muted'}`}>
                <Radio className={`w-5 h-5 ${isActive ? 'text-green-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <CardTitle className="text-lg">Webinar Mode</CardTitle>
                <CardDescription>
                  {isActive
                    ? 'LIVE — Serving cached data, rate limits bypassed'
                    : 'OFF — Normal operation, live API calls'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={isActive ? 'default' : 'secondary'} className={isActive ? 'bg-green-500' : ''}>
                {isActive ? 'ACTIVE' : 'INACTIVE'}
              </Badge>
              {statusQuery.isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Switch
                  checked={isActive}
                  onCheckedChange={handleToggle}
                  disabled={isToggling}
                />
              )}
            </div>
          </div>
        </CardHeader>
        {isActive && (
          <CardContent>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-200/80">
                Webinar mode is active. All API rate limits are bypassed and expired cache entries will be served.
                Remember to turn this off after your presentation.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Webinar Mode Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>When webinar mode is <strong className="text-foreground">ON</strong>:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Rate limiter is completely bypassed (no daily/per-minute limits)</li>
            <li>Expired cache entries are served instead of being deleted</li>
            <li>Step 2 (Property Report) falls back to cached data if API fails</li>
            <li>Step 5 (Full Analysis) falls back to previously saved reports</li>
          </ul>
          <p className="pt-2">
            This ensures smooth demo experiences during live presentations without consuming API quota.
            Properties listed below are available for instant demo use.
          </p>
        </CardContent>
      </Card>

      {/* Cached Properties */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Cached Properties ({properties.length})</CardTitle>
              <CardDescription>Properties with saved analysis data available for webinar demos</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => propertiesQuery.refetch()}
              disabled={propertiesQuery.isRefetching}
            >
              {propertiesQuery.isRefetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {propertiesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No cached properties yet.</p>
              <p className="text-xs mt-1">Run a full analysis (Step 5) on any property to cache it.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm text-foreground truncate">
                        {prop.address}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {prop.city && prop.state && (
                        <span>{prop.city}, {prop.state}</span>
                      )}
                      {prop.bedrooms && (
                        <span>{prop.bedrooms} BR / {prop.bathrooms || '?'} BA</span>
                      )}
                      {prop.annualRevenue && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(prop.annualRevenue)}/yr
                        </span>
                      )}
                      {prop.verdict && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {prop.verdict}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(prop.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 ml-2"
                    onClick={() => {
                      if (confirm(`Delete cached data for "${prop.address}"?`)) {
                        deleteMutation.mutate({ id: prop.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
