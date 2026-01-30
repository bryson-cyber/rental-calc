import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Mail, Phone, MapPin, Bell, MessageSquare, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

interface EmailOptinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pre-fill data from current context
  defaultCity?: string;
  defaultState?: string;
  defaultZip?: string;
  source?: string; // Which tool triggered the opt-in
}

export function EmailOptinModal({
  open,
  onOpenChange,
  defaultCity,
  defaultState,
  defaultZip,
  source = 'general',
}: EmailOptinModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    city: defaultCity || '',
    state: defaultState || '',
    zipCode: defaultZip || '',
    wantsMarketUpdates: true,
    wantsRegulationAlerts: true,
    wantsSmsAlerts: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const submitOptin = trpc.emailOptin.submit.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSubmitted(true);
        toast.success(data.isNew ? 'Successfully subscribed!' : 'Preferences updated!');
      } else {
        toast.error('Failed to subscribe. Please try again.');
      }
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('Please enter your email address');
      return;
    }

    // Get UTM params from URL
    const urlParams = new URLSearchParams(window.location.search);

    submitOptin.mutate({
      ...formData,
      source,
      utmSource: urlParams.get('utm_source') || undefined,
      utmMedium: urlParams.get('utm_medium') || undefined,
      utmCampaign: urlParams.get('utm_campaign') || undefined,
    });
  };

  const handleClose = () => {
    setSubmitted(false);
    onOpenChange(false);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">You're All Set!</h3>
            <p className="text-gray-600 mb-6">
              We'll send you personalized market updates for{' '}
              {formData.city && formData.state ? (
                <span className="font-medium">{formData.city}, {formData.state}</span>
              ) : (
                'your target markets'
              )}
              .
            </p>
            <Button onClick={handleClose} className="bg-[#C9A962] hover:bg-[#b89952] text-white">
              Continue Exploring
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-[#C9A962]/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#C9A962]" />
            </div>
            <DialogTitle className="text-xl">Get Personalized Market Updates</DialogTitle>
          </div>
          <DialogDescription>
            Receive daily property recommendations and market insights tailored to your target area.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName" className="text-sm text-gray-600">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm text-gray-600">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Smith"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-sm text-gray-600">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                required
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone" className="text-sm text-gray-600">Phone Number (for SMS alerts)</Label>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <Label className="text-sm text-gray-600">Target Market Location</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="relative col-span-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="pl-10"
                />
              </div>
              <Input
                placeholder="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
              <Input
                placeholder="ZIP"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              />
            </div>
          </div>

          {/* Preferences */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm text-gray-600">What would you like to receive?</Label>
            
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="marketUpdates"
                checked={formData.wantsMarketUpdates}
                onCheckedChange={(checked) => setFormData({ ...formData, wantsMarketUpdates: !!checked })}
              />
              <div className="flex-1">
                <label htmlFor="marketUpdates" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#C9A962]" />
                  Daily Property Recommendations
                </label>
                <p className="text-xs text-gray-500 mt-0.5">New listings and opportunities in your target market</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="regulationAlerts"
                checked={formData.wantsRegulationAlerts}
                onCheckedChange={(checked) => setFormData({ ...formData, wantsRegulationAlerts: !!checked })}
              />
              <div className="flex-1">
                <label htmlFor="regulationAlerts" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#C9A962]" />
                  Regulation Change Alerts
                </label>
                <p className="text-xs text-gray-500 mt-0.5">Get notified when STR regulations change in your area</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="smsAlerts"
                checked={formData.wantsSmsAlerts}
                onCheckedChange={(checked) => setFormData({ ...formData, wantsSmsAlerts: !!checked })}
                disabled={!formData.phone}
              />
              <div className="flex-1">
                <label htmlFor="smsAlerts" className={`text-sm font-medium cursor-pointer flex items-center gap-2 ${!formData.phone ? 'text-gray-400' : ''}`}>
                  <MessageSquare className="w-4 h-4 text-[#C9A962]" />
                  SMS Text Alerts
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formData.phone ? 'Receive urgent updates via text message' : 'Enter phone number to enable SMS alerts'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              className="w-full bg-[#C9A962] hover:bg-[#b89952] text-white h-12 text-base"
              disabled={submitOptin.isPending}
            >
              {submitOptin.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Get Personalized Updates
                </>
              )}
            </Button>
            <p className="text-xs text-center text-gray-500 mt-3">
              You can unsubscribe at any time. We respect your privacy.
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EmailOptinModal;
