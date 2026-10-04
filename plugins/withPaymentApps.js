/**
 * Lets checkout open UPI / wallet apps (GPay, PhonePe, Paytm, BHIM, CRED…) and come back.
 * Android 11+ and iOS only allow opening other apps that the app declares upfront.
 */
const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

const ANDROID_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user', // Google Pay
  'com.phonepe.app', // PhonePe
  'net.one97.paytm', // Paytm
  'in.org.npci.upiapp', // BHIM
  'com.dreamplug.androidapp', // CRED
  'in.amazon.mShop.android.shopping', // Amazon Pay
  'com.mobikwik_new', // MobiKwik
];
const IOS_SCHEMES = ['upi', 'tez', 'gpay', 'phonepe', 'paytmmp', 'paytm', 'bhim', 'credpay', 'amazonpay', 'mobikwik'];

module.exports = function withPaymentApps(config) {
  config = withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const queries = (manifest.queries = manifest.queries || [{}]);
    const q = queries[0];
    q.intent = q.intent || [];
    const hasUpi = q.intent.some((i) => i.data?.some((d) => d.$?.['android:scheme'] === 'upi'));
    if (!hasUpi) {
      q.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'upi' } }] });
    }
    q.package = q.package || [];
    for (const name of ANDROID_PACKAGES) {
      if (!q.package.some((p) => p.$?.['android:name'] === name)) q.package.push({ $: { 'android:name': name } });
    }
    return c;
  });
  config = withInfoPlist(config, (c) => {
    const list = new Set([...(c.modResults.LSApplicationQueriesSchemes || []), ...IOS_SCHEMES]);
    c.modResults.LSApplicationQueriesSchemes = [...list];
    return c;
  });
  return config;
};
