// Central API configuration
// Production backend URL - Railway deployment
const API_BASE_URL =
    process.env.REACT_APP_API_URL ||
    'https://no-zero-days-production.up.railway.app';

export default API_BASE_URL;
