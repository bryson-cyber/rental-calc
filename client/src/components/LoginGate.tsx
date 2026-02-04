/**
 * LoginGate Component
 * 
 * Requires users to sign in before accessing the rental calculator tools.
 * Free to use, but login is required to track usage and prevent abuse.
 */

import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  LogIn, 
  Calculator, 
  TrendingUp, 
  Shield, 
  Sparkles,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface LoginGateProps {
  children: React.ReactNode;
}

export function LoginGate({ children }: LoginGateProps) {
  const { user, isAuthenticated, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, show the children (the actual app)
  if (isAuthenticated && user) {
    return <>{children}</>;
  }

  // Not authenticated - show login gate
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-2xl mb-4">
            <Calculator className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Coach Inayah's Turnkey Tool
          </h1>
          <p className="text-slate-400">
            Your free rental revenue calculator
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-6">
            {/* Benefits */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">100% Free to Use</p>
                  <p className="text-sm text-slate-400">No credit card required</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">Real Market Data</p>
                  <p className="text-sm text-slate-400">Powered by real-time analytics</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">AI-Powered Insights</p>
                  <p className="text-sm text-slate-400">Get personalized recommendations</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium">5 Free Analyses Daily</p>
                  <p className="text-sm text-slate-400">Generous limits for serious investors</p>
                </div>
              </div>
            </div>

            {/* Login Button */}
            <Button 
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-6 text-lg"
              onClick={() => window.location.href = getLoginUrl()}
            >
              <LogIn className="w-5 h-5 mr-2" />
              Sign In to Get Started
            </Button>

            <p className="text-center text-sm text-slate-500 mt-4">
              Quick sign-in with Google, Apple, or email
            </p>
          </CardContent>
        </Card>

        {/* Trust Badge */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Trusted by 10,000+ real estate investors
        </p>
      </div>
    </div>
  );
}

export default LoginGate;
