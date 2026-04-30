import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coachinayah.rentalcalculator',
  appName: 'Coach Inayah Rental Tool',
  webDir: 'dist/client',
  // When running on device, point to your deployed production URL
  // so the app loads your live backend rather than a local server.
  // Remove or comment out `server` to bundle the web assets locally (offline mode).
  server: {
    url: 'https://coachinayahturnkeytool.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0F172A',
    scrollEnabled: true,
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F172A',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0F172A',
    },
  },
};

export default config;
