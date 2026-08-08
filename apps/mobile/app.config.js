/**
 * @file: app.config.js
 * @description: Expo config — версия, cleartext HTTP для field-test backend
 * @dependencies: app.json, EXPO_PUBLIC_API_URL, @expo/config-plugins
 * @created: 2026-07-15
 */

const {
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

const appJson = require('./app.json');
const expo = appJson.expo;

/** Expo иногда не прокидывает usesCleartextTraffic в manifest — патчим явно */
function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
}

module.exports = {
  expo: {
    ...expo,
    version: '1.0.2',
    android: {
      ...expo.android,
      versionCode: 14,
      usesCleartextTraffic: true,
    },
    plugins: [...(expo.plugins || []), withCleartextTraffic],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || '',
    },
  },
};
