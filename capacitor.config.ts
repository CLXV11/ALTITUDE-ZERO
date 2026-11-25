import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.flightsim.megatron',
  appName: 'محاكي الطيران المتكامل',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#020617',
    webContentsDebuggingEnabled: false,
  },
};

export default config;
