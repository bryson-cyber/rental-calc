import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bookmark, LogIn, UserPlus, X } from 'lucide-react';

interface SaveLoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueWithoutAccount: () => void;
  itemType: 'market' | 'property';
  itemName: string;
}

export function SaveLoginPrompt({
  isOpen,
  onClose,
  onContinueWithoutAccount,
  itemType,
  itemName,
}: SaveLoginPromptProps) {
  const { isAuthenticated } = useAuth();

  // If already authenticated, don't show the prompt
  if (isAuthenticated) {
    return null;
  }

  const handleCreateAccount = () => {
    // Redirect to login/signup page
    window.location.href = getLoginUrl();
  };

  const handleContinueLocal = () => {
    onContinueWithoutAccount();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Bookmark className="w-6 h-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Save {itemType === 'market' ? 'Market' : 'Property'}?
          </DialogTitle>
          <DialogDescription className="text-center">
            You're about to save <span className="font-medium text-slate-700">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Option 1: Create Account */}
          <div className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50/50">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-1">Create a Free Account</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Your saved {itemType === 'market' ? 'markets' : 'properties'} will be available on any device and never lost.
                </p>
                <ul className="text-sm text-slate-600 space-y-1 mb-3">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Access from any device
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Never lose your saved data
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Get personalized recommendations
                  </li>
                </ul>
                <Button 
                  onClick={handleCreateAccount}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Create Free Account
                </Button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500">or</span>
            </div>
          </div>

          {/* Option 2: Continue without account */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <Bookmark className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-slate-700 mb-1">Save to This Browser Only</h4>
                <p className="text-sm text-slate-500 mb-3">
                  Your data will be saved locally. If you clear your browser data or switch devices, it will be lost.
                </p>
                <Button 
                  variant="outline"
                  onClick={handleContinueLocal}
                  className="w-full"
                >
                  Continue Without Account
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for managing save with login prompt
export function useSaveWithPrompt() {
  const { isAuthenticated } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingSave, setPendingSave] = useState<{
    type: 'market' | 'property';
    name: string;
    callback: () => void;
  } | null>(null);

  const promptSave = (
    type: 'market' | 'property',
    name: string,
    saveCallback: () => void
  ) => {
    if (isAuthenticated) {
      // If authenticated, save directly
      saveCallback();
    } else {
      // Show prompt
      setPendingSave({ type, name, callback: saveCallback });
      setShowPrompt(true);
    }
  };

  const handleContinueWithoutAccount = () => {
    if (pendingSave) {
      pendingSave.callback();
    }
    setShowPrompt(false);
    setPendingSave(null);
  };

  const handleClose = () => {
    setShowPrompt(false);
    setPendingSave(null);
  };

  return {
    showPrompt,
    pendingSave,
    promptSave,
    handleContinueWithoutAccount,
    handleClose,
  };
}
