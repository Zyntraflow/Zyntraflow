export const en = {
  common: {
    appName: "Zyntraflow",
    copySuccess: "Copied",
    copyFail: "Unable to copy",
  },
  header: {
    home: "Home",
    launch: "Launch",
    alerts: "Alerts",
    dashboard: "Dashboard",
    setup: "Setup",
    diagnostics: "Diagnostics",
    premiumDecrypt: "Premium Decrypt",
    logout: "Logout",
  },
  premiumDecrypt: {
    pageTitle: "Premium Decrypt Tool",
    warningsTitle: "Warnings",
    warningsDescription: "Decryption runs in-browser only. This page does not send package JSON or signature to any API.",
    warningDoNotShareSignature: "Do not share your signature publicly.",
    warningNoPrivateKeys: "Do not paste private keys into this tool.",
    warningNoStorage: "No data is stored in localStorage by this page.",
    fetchSectionTitle: "Fetch Package",
    fetchSectionDescription: "Optional: load package JSON from /api/premium/<reportHash>/<address> before decrypting.",
    packageTitle: "Paste Package",
    packageDescription: "Paste PremiumPackage JSON payload.",
    signatureTitle: "Paste Signature",
    signatureDescription: "Paste the same login signature used to unlock premium mode.",
    outputTitle: "Decrypted Output",
    outputDescription: "Decoded ScanReport data (client-side decrypted).",
  },
  alerts: {
    pageTitle: "Alerts",
    latestTitle: "Latest Alerts",
    latestDescription: "In-app notifications feed from /api/alerts/latest.",
    filtersTitle: "Filters",
    filtersDescription: "Filter by chain and profile coverage for a cleaner inbox view.",
    noAlerts: "No alert events published yet.",
  },
} as const;

export type UiDictionary = typeof en;
