import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, Loader2, FileText, AlertCircle, Info, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: number;
  userId: number | null;
  type: "report_generated" | "system" | "alert" | "info";
  title: string;
  message: string;
  metadata: unknown;
  isRead: number;
  readAt: Date | null;
  createdAt: Date;
}

const typeIcons = {
  report_generated: FileText,
  system: Info,
  alert: AlertCircle,
  info: Info,
};

const typeColors = {
  report_generated: "text-emerald-500 bg-emerald-50",
  system: "text-blue-500 bg-blue-50",
  alert: "text-amber-500 bg-amber-50",
  info: "text-slate-500 bg-slate-50",
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Fetch notifications
  const { data: notificationsData, isLoading, refetch } = trpc.notifications.getAll.useQuery(
    { limit: 20, includeRead: true },
    { 
      refetchInterval: 30000, // Refetch every 30 seconds
      enabled: true,
    }
  );
  
  // Mutations
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => refetch(),
  });
  
  const clearAllMutation = trpc.notifications.clearAll.useMutation({
    onSuccess: () => refetch(),
  });
  
  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter((n: Notification) => n.isRead === 0).length;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate({ notificationId: id });
  };
  
  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };
  
  const handleClearAll = () => {
    clearAllMutation.mutate();
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
          isOpen && "bg-slate-100"
        )}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      
      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Bell className="w-10 h-10 mb-2 text-slate-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification: Notification) => {
                  const Icon = typeIcons[notification.type] || Info;
                  const colorClass = typeColors[notification.type] || typeColors.info;
                  
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer",
                        notification.isRead === 0 && "bg-amber-50/50"
                      )}
                      onClick={() => {
                        if (notification.isRead === 0) {
                          handleMarkAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex gap-3">
                        <div className={cn("p-2 rounded-lg flex-shrink-0", colorClass)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm font-medium text-slate-900 truncate",
                              notification.isRead === 0 && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            {notification.isRead === 0 && (
                              <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-amber-500 rounded-full" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-center text-slate-500">
                {unreadCount > 0 
                  ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                  : 'All caught up!'
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
