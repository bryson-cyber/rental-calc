import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogIn, LogOut, User, ChevronDown, Loader2, Save, Settings, Calculator, Shield, FileText, Send } from 'lucide-react';
import { Link } from 'wouter';

export function AuthButton() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Loading state - 44px minimum touch target
  if (loading) {
    return (
      <Button variant="ghost" disabled className="gap-2 min-h-[44px] min-w-[44px] px-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  // Not authenticated - show login button with 44px minimum touch target
  if (!isAuthenticated || !user) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          window.location.href = getLoginUrl();
        }}
        className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 min-h-[44px] min-w-[44px] px-4"
      >
        <LogIn className="w-5 h-5" />
        <span>Login</span>
      </Button>
    );
  }

  // Authenticated - show user dropdown with 44px minimum touch target
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 hover:bg-slate-100 min-h-[44px] min-w-[44px] px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-sm font-semibold">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="hidden sm:inline text-slate-700 font-medium max-w-[120px] truncate">
            {user.name || 'User'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
        <Link href="/my-reports">
          <DropdownMenuItem className="gap-2 cursor-pointer min-h-[44px]">
            <FileText className="w-4 h-4" />
            <span>My Reports</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/saved-items">
          <DropdownMenuItem className="gap-2 cursor-pointer min-h-[44px]">
            <Save className="w-4 h-4" />
            <span>My Saved Items</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/account">
          <DropdownMenuItem className="gap-2 cursor-pointer min-h-[44px]">
            <Settings className="w-4 h-4" />
            <span>Account Settings</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <Link href="/investment-calculator">
          <DropdownMenuItem className="gap-2 cursor-pointer min-h-[44px]">
            <Calculator className="w-4 h-4" />
            <span>Investment Calculator</span>
          </DropdownMenuItem>
        </Link>
        {user.role === 'admin' && (
          <>
            <DropdownMenuSeparator />
            <Link href="/admin/dashboard">
              <DropdownMenuItem className="gap-2 cursor-pointer min-h-[44px] bg-amber-50 text-amber-800 hover:bg-amber-100">
                <Shield className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/webinar-campaigns">
              <DropdownMenuItem className="gap-2 cursor-pointer min-h-[44px] bg-amber-50 text-amber-800 hover:bg-amber-100">
                <Send className="w-4 h-4" />
                <span>Webinar Campaigns</span>
              </DropdownMenuItem>
            </Link>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 min-h-[44px]"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
