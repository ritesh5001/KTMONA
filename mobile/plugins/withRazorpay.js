const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

/**
 * Native configuration for react-native-razorpay.
 *
 * The package autolinks, but its UPI "intent" flow (pay in GPay / PhonePe /
 * Paytm without typing a UPI id) only works if the app may see those apps:
 *
 * Android : Android 11+ hides installed packages unless they (or the `upi:`
 *           intent) are declared under <queries>; without it Checkout shows no
 *           UPI apps at all.
 * iOS     : iOS only reports an app as installed when its URL scheme is in
 *           LSApplicationQueriesSchemes (Razorpay's iOS UPI-intent guide).
 *
 * Both lists are merged with what other plugins add, never replaced.
 */

const UPI_QUERY_PACKAGES = [
  "com.google.android.apps.nbu.paisa.user",
  "com.phonepe.app",
  "net.one97.paytm",
  "in.org.npci.upiapp",
  "in.amazon.mShop.android.shopping",
  "com.dreamplug.androidapp",
];

const UPI_QUERY_SCHEMES = [
  "tez",
  "phonepe",
  "paytmmp",
  "credpay",
  "mobikwik",
  "in.fampay.app",
  "bhim",
  "amazonpay",
  "myjio",
  "kiwi",
  "popclubapp",
  "upi",
  "superupi",
  "navipay",
];

function withRazorpayAndroidQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    manifest.queries = manifest.queries ?? [];
    if (manifest.queries.length === 0) {
      manifest.queries.push({});
    }

    const queries = manifest.queries[0];
    queries.package = queries.package ?? [];
    queries.intent = queries.intent ?? [];

    const declared = new Set(
      queries.package.map((entry) => entry?.$?.["android:name"]).filter(Boolean)
    );
    for (const name of UPI_QUERY_PACKAGES) {
      if (declared.has(name)) continue;
      queries.package.push({ $: { "android:name": name } });
    }

    // Covers every other UPI app: anything that handles a upi:// link.
    const hasUpiIntent = queries.intent.some((intent) =>
      (intent?.data ?? []).some((data) => data?.$?.["android:scheme"] === "upi")
    );
    if (!hasUpiIntent) {
      queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": "upi" } }],
      });
    }

    return mod;
  });
}

function withRazorpayQuerySchemes(config) {
  return withInfoPlist(config, (mod) => {
    const existing = mod.modResults.LSApplicationQueriesSchemes ?? [];
    mod.modResults.LSApplicationQueriesSchemes = Array.from(new Set([...existing, ...UPI_QUERY_SCHEMES]));
    return mod;
  });
}

module.exports = function withRazorpay(config) {
  config = withRazorpayAndroidQueries(config);
  config = withRazorpayQuerySchemes(config);
  return config;
};
