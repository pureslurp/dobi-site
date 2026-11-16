const { reportError } = require("./lib/error-reporter");

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return null;
    }
  }
  return body;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req);
  if (!body) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { error, context, platform, _debug } = body;

  if (!error || typeof error !== "string") {
    return res.status(400).json({ error: "Missing error message" });
  }

  const result = await reportError({
    endpoint: "client-side-checkout",
    stripeError: {
      message: error.slice(0, 500),
      type: "client_error",
      code: context || "unknown",
    },
    platform: platform || "unknown",
    userAgent: req.headers["user-agent"],
    additionalInfo: {
      client_reported: "true",
    },
  });

  const response = { ok: true };
  
  // Include debug info if requested (for testing only)
  if (_debug === true) {
    response.debug = result;
  }

  return res.status(200).json(response);
};
