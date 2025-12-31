import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Bookmark, 
  MapPin, 
  Home, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  TrendingUp,
  Building2,
  DollarSign,
  Percent
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// Generate or retrieve session ID for anonymous users
function getSessionId(): string {
  let sessionId = localStorage.getItem("rental_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("rental_session_id", sessionId);
  }
  return sessionId;
}

interface SavedSearch {
  id: number;
  searchType: "market" | "property";
  marketId?: string | null;
  marketName?: string | null;
  submarketId?: string | null;
  submarketName?: string | null;
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: string | null;
  cachedRevenue?: number | null;
  cachedOccupancy?: string | null;
  cachedAdr?: number | null;
  label?: string | null;
  notes?: string | null;
  createdAt: Date;
}

interface SavedSearchesProps {
  onNavigate?: (path: string) => void;
  compact?: boolean;
}

export function SavedSearches({ onNavigate, compact = false }: SavedSearchesProps) {
  const [, setLocation] = useLocation();
  const sessionId = getSessionId();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: searchesData, refetch } = trpc.savedSearches.list.useQuery(
    { sessionId },
    { refetchOnWindowFocus: false }
  );

  const deleteMutation = trpc.savedSearches.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Search removed from saved");
    },
    onError: () => {
      toast.error("Failed to remove search");
    },
  });

  const updateMutation = trpc.savedSearches.update.useMutation({
    onSuccess: () => {
      refetch();
      setEditingId(null);
      toast.success("Label updated");
    },
    onError: () => {
      toast.error("Failed to update label");
    },
  });

  const searches = searchesData?.data || [];

  const handleNavigate = (search: SavedSearch) => {
    if (search.searchType === "market" && search.marketId) {
      const path = `/compare?market=${encodeURIComponent(search.marketId)}`;
      if (onNavigate) {
        onNavigate(path);
      } else {
        setLocation(path);
      }
    } else if (search.searchType === "property" && search.address) {
      // Navigate to home with address pre-filled (would need to implement)
      const path = `/?address=${encodeURIComponent(search.address)}`;
      if (onNavigate) {
        onNavigate(path);
      } else {
        setLocation(path);
      }
    }
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id, sessionId });
  };

  const handleStartEdit = (search: SavedSearch) => {
    setEditingId(search.id);
    setEditLabel(search.label || "");
  };

  const handleSaveEdit = (id: number) => {
    updateMutation.mutate({ id, sessionId, label: editLabel });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (searches.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Bookmark className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-medium text-lg mb-1">No Saved Searches</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Save markets or properties to quickly access them later. Click the bookmark icon when viewing results.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {searches.slice(0, 5).map((search) => (
          <div
            key={search.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
            onClick={() => handleNavigate(search)}
          >
            <div className="flex items-center gap-3">
              {search.searchType === "market" ? (
                <Building2 className="h-4 w-4 text-primary" />
              ) : (
                <Home className="h-4 w-4 text-primary" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {search.label || search.marketName || search.address?.split(",")[0]}
                </p>
                {search.cachedRevenue && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(search.cachedRevenue)}/yr
                  </p>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {search.searchType}
            </Badge>
          </div>
        ))}
        {searches.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setLocation("/saved")}
          >
            View all {searches.length} saved searches
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searches.map((search) => (
        <Card key={search.id} className="overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div 
                className="flex-1 cursor-pointer"
                onClick={() => handleNavigate(search)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {search.searchType === "market" ? (
                    <Building2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Home className="h-5 w-5 text-primary" />
                  )}
                  
                  {editingId === search.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-7 text-sm"
                        placeholder="Add a label..."
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleSaveEdit(search.id)}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={handleCancelEdit}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <h3 className="font-semibold">
                      {search.label || search.marketName || search.address?.split(",")[0] || "Unnamed Search"}
                    </h3>
                  )}
                  
                  <Badge variant={search.searchType === "market" ? "default" : "secondary"}>
                    {search.searchType === "market" ? "Market" : "Property"}
                  </Badge>
                </div>

                {search.searchType === "market" && search.marketName && !search.label && (
                  <p className="text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {search.marketName}
                  </p>
                )}

                {search.searchType === "property" && search.address && (
                  <p className="text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    {search.address}
                    {search.bedrooms && ` • ${search.bedrooms} BR`}
                  </p>
                )}

                {/* Cached metrics */}
                {(search.cachedRevenue || search.cachedOccupancy || search.cachedAdr) && (
                  <div className="flex flex-wrap gap-4 mt-3">
                    {search.cachedRevenue && (
                      <div className="flex items-center gap-1 text-sm">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{formatCurrency(search.cachedRevenue)}</span>
                        <span className="text-muted-foreground">/year</span>
                      </div>
                    )}
                    {search.cachedOccupancy && (
                      <div className="flex items-center gap-1 text-sm">
                        <Percent className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{parseFloat(search.cachedOccupancy).toFixed(0)}%</span>
                        <span className="text-muted-foreground">occupancy</span>
                      </div>
                    )}
                    {search.cachedAdr && (
                      <div className="flex items-center gap-1 text-sm">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">{formatCurrency(search.cachedAdr)}</span>
                        <span className="text-muted-foreground">/night</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(search);
                  }}
                >
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(search.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Hook for saving searches from other components
export function useSaveSearch() {
  const sessionId = getSessionId();
  const saveMutation = trpc.savedSearches.save.useMutation({
    onSuccess: () => {
      toast.success("Search saved!");
    },
    onError: () => {
      toast.error("Failed to save search");
    },
  });

  const saveMarket = (data: {
    marketId: string;
    marketName: string;
    cachedRevenue?: number;
    cachedOccupancy?: number;
    cachedAdr?: number;
  }) => {
    saveMutation.mutate({
      sessionId,
      searchType: "market",
      marketId: data.marketId,
      marketName: data.marketName,
      cachedRevenue: data.cachedRevenue,
      cachedOccupancy: data.cachedOccupancy,
      cachedAdr: data.cachedAdr,
    });
  };

  const saveProperty = (data: {
    address: string;
    latitude?: number;
    longitude?: number;
    bedrooms?: number;
    bathrooms?: number;
    cachedRevenue?: number;
    cachedOccupancy?: number;
    cachedAdr?: number;
  }) => {
    saveMutation.mutate({
      sessionId,
      searchType: "property",
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      cachedRevenue: data.cachedRevenue,
      cachedOccupancy: data.cachedOccupancy,
      cachedAdr: data.cachedAdr,
    });
  };

  return {
    saveMarket,
    saveProperty,
    isSaving: saveMutation.isPending,
  };
}

export { getSessionId };
