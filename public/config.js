if (
  !["127.0.0.1", "localhost", "gyan-chakra-test-app-production.up.railway.app"].includes(window.location.hostname)
) {
  window.GYAN_API_BASE_URL = "https://gyan-chakra-test-app-production.up.railway.app";
}
