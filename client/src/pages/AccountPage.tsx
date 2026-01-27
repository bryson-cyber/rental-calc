import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Mail, 
  Calendar,
  LogOut,
  Loader2,
  ArrowLeft,
  LogIn,
  Save,
  MapPin,
  Home,
  Shield,
  Clock,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { getLoginUrl } from '@/const';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AccountPage() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Session ID for anonymous users
  const [sessionId] = useState(() => {
    return localStorage.getItem('savedItemsSessionId') || '';
  });

  // Fetch saved data counts
  const savedSearchesQuery = trpc.savedSearches.list.useQuery({ 
    sessionId: !isAuthenticated ? sessionId : undefined 
  });
  
  const favoritePropertiesQuery = trpc.favorites.list.useQuery({ 
    sessionId: !isAuthenticated ? sessionId : undefined 
  });

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      setLocation('/');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Count saved items
  const savedMarketsCount = savedSearchesQuery.data?.data?.filter(s => s.searchType === 'market').length || 0;
  const savedPropertiesCount = favoritePropertiesQuery.data?.data?.length || 0;

  // If not authenticated, show login prompt
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  My Account
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Login Required Message */}
        <div className="container mx-auto px-4 py-16">
          <Card className="max-w-md mx-auto border-dashed border-2 border-slate-300">
            <CardContent className="pt-12 pb-12 text-center">
              <LogIn className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Login Required</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Create a free account to access your profile settings and manage your saved data.
              </p>
              <Button 
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => window.location.href = getLoginUrl()}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login or Create Account
              </Button>
              <p className="text-xs text-slate-400 mt-4">
                All tools remain free to use without an account
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  My Account
                </h1>
                <p className="text-sm text-slate-500">
                  Manage your profile and settings
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Profile Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-amber-600" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your account details from Manus authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar and Name */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white text-2xl font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{user?.name || 'User'}</h3>
                <Badge variant="outline" className="mt-1">
                  <Shield className="w-3 h-3 mr-1" />
                  {user?.role === 'admin' ? 'Administrator' : 'Free Account'}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Email */}
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="text-slate-900">{user?.email || 'Not provided'}</p>
              </div>
            </div>

            {/* Login Method */}
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Login Method</p>
                <p className="text-slate-900 capitalize">{user?.loginMethod || 'Manus OAuth'}</p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Member Since</p>
                <p className="text-slate-900">{formatDate(user?.createdAt)}</p>
              </div>
            </div>

            {/* Last Sign In */}
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm text-slate-500">Last Sign In</p>
                <p className="text-slate-900">{formatDate(user?.lastSignedIn)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saved Data Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="w-5 h-5 text-amber-600" />
              Saved Data
            </CardTitle>
            <CardDescription>
              Your saved markets and properties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/saved-items">
                <div className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">Saved Markets</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{savedMarketsCount}</p>
                </div>
              </Link>
              <Link href="/saved-items">
                <div className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Home className="w-4 h-4" />
                    <span className="text-sm">Saved Properties</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{savedPropertiesCount}</p>
                </div>
              </Link>
            </div>
            <div className="mt-4">
              <Link href="/saved-items">
                <Button variant="outline" className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  View All Saved Items
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logout Button */}
            <Button 
              variant="outline" 
              className="w-full justify-start text-slate-600 hover:text-slate-900"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              Sign Out
            </Button>

            <Separator />

            {/* Danger Zone */}
            <div className="pt-2">
              <p className="text-sm text-slate-500 mb-3 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Danger Zone
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Saved Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your saved markets and properties. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                      Delete All Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <p className="text-center text-sm text-slate-400 mt-8">
          Need help? Contact support at{' '}
          <a href="mailto:support@coachinayah.com" className="text-amber-600 hover:underline">
            support@coachinayah.com
          </a>
        </p>
      </div>
    </div>
  );
}
