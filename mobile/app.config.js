const fs = require("fs");
const path = require("path");

// Google's public test AdMob app id until the real one is set in .env.
const ADMOB_APP_ID = process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713";
// Firebase needs google-services.json at build time, so it switches on only when that file is present.
const firebase = fs.existsSync(path.join(__dirname, "google-services.json"));

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, ...(firebase ? { googleServicesFile: "./google-services.json" } : {}) },
  plugins: [
    ...config.plugins,
    ["react-native-google-mobile-ads", { androidAppId: ADMOB_APP_ID, delayAppMeasurementInit: true }],
    ...(firebase ? ["@react-native-firebase/app"] : []),
    "./plugins/withReleaseSigning",
  ],
  extra: { ...config.extra, firebase },
});
