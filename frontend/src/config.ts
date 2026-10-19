// Central API configuration
// In production (Railway), REACT_APP_API_URL is injected at build time.
// In local development, falls back to the device's hostname on port 8080.
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `http://${window.location.hostname}:8080`;

export default API_BASE_URL;
