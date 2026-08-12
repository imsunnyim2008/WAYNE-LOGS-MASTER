// WAYNE LOGS API configuration.
// For local Live Server it uses localhost:5000.
// For production it expects a Render service named: wayne-logs-master-api
window.WAYNE_API_URL = ["localhost","127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";
