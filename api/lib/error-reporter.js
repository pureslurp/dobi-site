/**
 * Fire-and-forget error reporter for checkout failures.
 * Sends debug info to Sean via FormSubmit (pureslurp@gmail.com).
 * 
 * Never includes secrets, full card data, or full customer addresses.
 */

const REPORT_EMAIL = "pureslurp@gmail.com";
const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${REPORT_EMAIL}`;
const REPORT_TIMEOUT_MS = 3000;
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

const recentErrors = new Map();

function getErrorFingerprint(endpoint, errorCode, errorType) {
  return `${endpoint}:${errorCode}:${errorType}`;
}

function shouldReport(endpoint, errorCode, errorType) {
  const fingerprint = getErrorFingerprint(endpoint, errorCode, errorType);
  const now = Date.now();
  const lastReported = recentErrors.get(fingerprint);
  
  if (lastReported && now - lastReported < DEDUPE_WINDOW_MS) {
    return false;
  }
  
  recentErrors.set(fingerprint, now);
  
  setTimeout(() => {
    recentErrors.delete(fingerprint);
  }, DEDUPE_WINDOW_MS);
  
  return true;
}

function sanitizeUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== "string") {
    return "unknown";
  }
  return userAgent.slice(0, 200);
}

async function reportError(options) {
  const {
    endpoint,
    stripeError,
    platform,
    userAgent,
    additionalInfo = {},
  } = options;
  
  const errorCode = stripeError?.code || "unknown";
  const errorType = stripeError?.type || "unknown";
  
  if (!shouldReport(endpoint, errorCode, errorType)) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const vercelEnv = process.env.VERCEL_ENV || "local";
  const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA
    ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
    : "unknown";
  
  const reportData = {
    _subject: `Checkout Error: ${endpoint}`,
    _template: "table",
    _captcha: "false",
    endpoint,
    timestamp,
    stripe_error_message: stripeError?.message || "unknown",
    stripe_error_type: errorType,
    stripe_error_code: errorCode,
    stripe_request_id: stripeError?.raw?.requestId || stripeError?.requestId || "unknown",
    platform: platform || "unknown",
    vercel_env: vercelEnv,
    vercel_commit: vercelCommit,
    user_agent: sanitizeUserAgent(userAgent),
    ...additionalInfo,
  };
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  
  try {
    await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(reportData),
      signal: controller.signal,
    });
  } catch (err) {
    // Ignore errors - this is fire-and-forget
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { reportError };
