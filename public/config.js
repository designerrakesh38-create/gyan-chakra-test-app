const GYAN_CLOUD_API = "https://gyan-chakra-test-app-production.up.railway.app";
const isNativeApp = Boolean(window.Capacitor) || window.location.protocol === "capacitor:" || (window.location.protocol === "https:" && window.location.hostname === "localhost");
const isLocalPreview = window.location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
const isCloudPage = window.location.hostname === "gyan-chakra-test-app-production.up.railway.app";

if (isNativeApp || (!isLocalPreview && !isCloudPage)) {
  window.GYAN_API_BASE_URL = GYAN_CLOUD_API;
}
