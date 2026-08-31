import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.markbel.vault',
  appName: 'Markbel',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: '#090d16',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#090d16'
    }
  }
};

export default config;
