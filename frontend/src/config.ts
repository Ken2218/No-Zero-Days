// Central API configuration
// In production (Railway), REACT_APP_API_URL is injected at build time.
// In local development, falls back to the device's hostname on port 8080.
const isLocalhost = Boolean(
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  )
);

const envUrl = process.env.REACT_APP_API_URL;
const isRemoteRailway = Boolean(envUrl && envUrl.includes('railway.app'));

const API_BASE_URL =
  (isLocalhost && isRemoteRailway)
    ? `http://${window.location.hostname}:8080`
    : (envUrl || `http://${window.location.hostname}:8080`);

export default API_BASE_URL;
