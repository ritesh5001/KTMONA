const {
  withProjectBuildGradle,
  withAndroidManifest,
  withInfoPlist,
  withAppDelegate,
} = require("expo/config-plugins");

/**
 * Native configuration for react-native-phonepe-pg.
 *
 * The package ships no Expo config plugin, so in a managed workflow none of its
 * native requirements are applied and the build fails — or worse, succeeds and
 * crashes when the SDK is opened. This adds the things PhonePe's setup guide
 * asks for by hand, so `expo prebuild` produces a correct project and the repo
 * stays managed (no checked-in android/ or ios/ directories).
 *
 * Android : PhonePe's IntentSDK is not on mavenCentral. It lives on their own
 *           Maven repository, which has to be declared at the project level.
 *           The SDK also hands the payment off to a UPI app by intent, which
 *           Android 11+ hides unless those packages are declared in <queries>.
 * iOS     : the SDK opens the PhonePe / GPay / Paytm apps to complete a payment.
 *           iOS refuses to report those as installed unless their URL schemes
 *           are declared in LSApplicationQueriesSchemes, and the SDK cannot
 *           return control to us without an openURL hook.
 */

const PHONEPE_MAVEN_URL =
  "https://phonepe.mycloudrepo.io/public/repositories/phonepe-intentsdk-android";

/**
 * UPI apps the SDK launches to complete a payment.
 *
 * Android 11 (API 30) made installed packages invisible by default: without a
 * matching <queries> entry `resolveActivity` returns null, the SDK cannot find
 * the app to hand off to, and PhonePe's page fails with a generic "Something
 * went wrong" after the buyer has already picked a method — with no transaction
 * ever recorded against the order.
 */
const PHONEPE_QUERY_PACKAGES = [
  "com.phonepe.app",
  "com.phonepe.app.preprod",
  "com.google.android.apps.nbu.paisa.user",
  "net.one97.paytm",
];

/** Schemes the SDK probes for, per PhonePe's iOS setup instructions. */
const PHONEPE_QUERY_SCHEMES = [
  "ppemerchantsdkv1",
  "ppemerchantsdkv2",
  "ppemerchantsdkv3",
  "paytmmp",
  "gpay",
];

/**
 * The notification name the SDK listens on. PhonePe's guide has this posted from
 * AppDelegate's openURL; without it the app never learns that the PhonePe app
 * handed control back, and the transaction promise hangs.
 */
const OPEN_URL_HOOK = `
- (BOOL)application:(UIApplication *)app openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  NSMutableDictionary *userInfo = [[NSMutableDictionary alloc] init];
  [userInfo setObject:options forKey:@"options"];
  [userInfo setObject:url forKey:@"openUrl"];
  [[NSNotificationCenter defaultCenter] postNotificationName:@"ApplicationOpenURLNotification" object:nil userInfo:userInfo];
  return [super application:app openURL:url options:options];
}
`;

function withPhonePeAndroidRepo(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") {
      throw new Error(
        "withPhonePeSdk: project build.gradle is not groovy; cannot add the PhonePe Maven repository."
      );
    }
    if (mod.modResults.contents.includes(PHONEPE_MAVEN_URL)) {
      return mod;
    }

    // Insert into allprojects.repositories. Anchoring on `mavenCentral()` is
    // safer than matching the block itself, which Expo's template formats
    // differently between SDK versions.
    const anchor = /allprojects\s*\{[\s\S]*?repositories\s*\{/;
    if (!anchor.test(mod.modResults.contents)) {
      throw new Error(
        "withPhonePeSdk: could not find allprojects.repositories in build.gradle."
      );
    }

    mod.modResults.contents = mod.modResults.contents.replace(
      anchor,
      (match) => `${match}\n        maven { url "${PHONEPE_MAVEN_URL}" }`
    );

    return mod;
  });
}

/**
 * Declare the UPI apps and the `upi:` intent under <queries>.
 *
 * `withAndroidManifest` hands us the parsed manifest object, where <queries> is
 * a sibling of <application> under <manifest>. Entries are merged rather than
 * replaced — expo-image-picker and others add their own.
 */
function withPhonePeAndroidQueries(config) {
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
    for (const name of PHONEPE_QUERY_PACKAGES) {
      if (declared.has(name)) continue;
      queries.package.push({ $: { "android:name": name } });
    }

    // Covers UPI apps beyond the four named above: anything that can handle a
    // upi:// deep link stays resolvable.
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

function withPhonePeQuerySchemes(config) {
  return withInfoPlist(config, (mod) => {
    const existing = mod.modResults.LSApplicationQueriesSchemes ?? [];
    // Merge rather than replace: expo-image-picker and others add their own.
    const merged = new Set([...existing, ...PHONEPE_QUERY_SCHEMES]);
    mod.modResults.LSApplicationQueriesSchemes = Array.from(merged);
    return mod;
  });
}

function withPhonePeOpenUrl(config) {
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.contents.includes("ApplicationOpenURLNotification")) {
      return mod;
    }

    // Expo SDK 54 ships a Swift AppDelegate. The Objective-C hook below only
    // applies to the older template; failing loudly is better than silently
    // producing a build where the SDK can never return a result.
    if (mod.modResults.language === "swift") {
      mod.modResults.contents = insertSwiftOpenUrl(mod.modResults.contents);
      return mod;
    }

    const anchor = "@end";
    const index = mod.modResults.contents.lastIndexOf(anchor);
    if (index === -1) {
      throw new Error("withPhonePeSdk: could not find @end in AppDelegate.");
    }
    mod.modResults.contents =
      mod.modResults.contents.slice(0, index) +
      OPEN_URL_HOOK +
      "\n" +
      mod.modResults.contents.slice(index);

    return mod;
  });
}

/**
 * Add the notification to the AppDelegate's EXISTING openURL, rather than
 * declaring a second one.
 *
 * Expo's SDK 54 template already implements
 * `application(_:open:options:)` to hand deep links to RCTLinkingManager.
 * Appending PhonePe's version verbatim — as their Objective-C guide shows —
 * produces two methods with identical signatures, which Swift rejects outright
 * with "invalid redeclaration". The build fails before anything runs.
 *
 * So the post is injected into the body of the method that is already there,
 * ahead of its return, leaving the existing deep-link behaviour intact.
 */
function insertSwiftOpenUrl(contents) {
  const post = `    NotificationCenter.default.post(
      name: Notification.Name("ApplicationOpenURLNotification"),
      object: nil,
      userInfo: ["openUrl": url, "options": options]
    )
`;

  // Match the existing openURL implementation and prepend the notification to
  // whatever it currently returns.
  const openUrlBody =
    /(public override func application\(\s*_ app: UIApplication,\s*open url: URL,\s*options: \[UIApplication\.OpenURLOptionsKey: Any\] = \[:\]\s*\) -> Bool \{\n)(\s*return )/;

  if (!openUrlBody.test(contents)) {
    throw new Error(
      "withPhonePeSdk: could not find the AppDelegate openURL method to hook. " +
        "The Expo template may have changed — the PhonePe SDK will not receive " +
        "its callback without this."
    );
  }

  return contents.replace(openUrlBody, (_m, signature, ret) => `${signature}${post}${ret}`);
}

module.exports = function withPhonePeSdk(config) {
  config = withPhonePeAndroidRepo(config);
  config = withPhonePeAndroidQueries(config);
  config = withPhonePeQuerySchemes(config);
  config = withPhonePeOpenUrl(config);
  return config;
};
