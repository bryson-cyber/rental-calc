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
import { LogIn, LogOut, User, ChevronDown, Loader2, Save, Settings, Calculator } from 'lucide-react';
import { Link } from 'wouter';

export function AuthButton() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Loading state
  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  // Not authenticated - show login button
  if (!isAuthenticated || !user) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          window.location.href = getLoginUrl();
        }}
        className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
      >
        <LogIn className="w-4 h-4" />
        <span>Login</span>
      </Button>
    );
  }

  // Authenticated - show user dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 hover:bg-slate-100">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-semibold">
            {user.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="hidden sm:inline text-slate-700 font-medium max-w-[120px] truncate">
            {user.name || 'User'}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
        <Link href="/saved-items">
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <Save className="w-4 h-4" />
            <span>My Saved Items</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/account">
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <Settings className="w-4 h-4" />
            <span>Account Settings</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <Link href="/investment-calculator">
          <DropdownMenuItem className="gap-2 cursor-pointer">
            <Calculator className="w-4 h-4" />
            <span>Investment Calculator</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
