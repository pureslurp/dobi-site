/**
 * Canonical site base for Stripe return URLs (no trailing slash).
 * If SITE_URL mistakenly includes `/order-success.html`, strip it so we never
 * build `.../order-success.html/order-success.html`.
 */
function normalizeSiteUrlFromEnv(raw) {
  const s = String(raw).trim().replace(/\/$/, "");
  if (!s) return null;
  try {
    let urlStr =
      s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
    const u = new URL(urlStr);
    if (u.hostname === "www.localhost") {
      u.hostname = "localhost";
    }
    if (u.hostname === "localhost" && u.protocol === "https:") {
      u.protocol = "http:";
    }
    let path = u.pathname;
    if (path.endsWith("order-success.html")) {
      path = path.replace(/\/?order-success\.html$/, "");
    }
    if (path === "/" || path === "") {
      path = "";
    } else if (path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return u.origin + path;
  } catch {
    return s;
  }
}

function baseUrl() {
  if (process.env.SITE_URL) {
    return normalizeSiteUrlFromEnv(process.env.SITE_URL);
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

module.exports = { baseUrl, normalizeSiteUrlFromEnv };
