import { SavedSearches } from "@/components/SavedSearches";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bookmark } from "lucide-react";
import { useLocation } from "wouter";

export default function SavedSearchesPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-primary" />
              Saved Searches
            </h1>
            <p className="text-muted-foreground">
              Quickly access your saved markets and properties
            </p>
          </div>
        </div>

        {/* Saved Searches List */}
        <SavedSearches />
      </div>
    </div>
  );
}
