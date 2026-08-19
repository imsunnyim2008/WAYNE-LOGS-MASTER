// WAYNE LOGS API configuration.
// For local Live Server it uses localhost:5000.
// For production it expects a Render service named: wayne-logs-master-api
window.WAYNE_API_URL = ["localhost","127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";

// Keep every customer and admin page on the same premium visual system.
if (!document.querySelector('link[href="premium-pages.css"]')) {
  const premiumTheme = document.createElement("link");
  premiumTheme.rel = "stylesheet";
  premiumTheme.href = "premium-pages.css";
  document.head.appendChild(premiumTheme);
}
