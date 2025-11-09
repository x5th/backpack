import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.backpack.wallet',
  appName: 'Backpack Wallet',
  webDir: '../packages/app-extension/build',
  server: {
    cleartext: true
  },
  android: {
    webContentsDebuggingEnabled: true
  }
};

export default config;
