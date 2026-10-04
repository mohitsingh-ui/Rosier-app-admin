/**
 * Uses google-services.json (Firebase — needed for push notifications on Android)
 * only when the file is there, so builds without it still work.
 * Put the file in the project root, or point GOOGLE_SERVICES_JSON at it (CI / EAS secret file).
 */
const fs = require('fs');
const path = require('path');

module.exports = function withGoogleServices(config) {
  const file = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  const abs = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(abs)) {
    console.warn('[push] google-services.json not found — Android push notifications stay off until you add it.');
    return config;
  }
  return { ...config, android: { ...config.android, googleServicesFile: file } };
};
