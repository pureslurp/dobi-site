module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const pk = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!pk || !pk.startsWith("pk_")) {
    return res.status(503).json({
      error:
        "Checkout is not fully configured. Add STRIPE_PUBLISHABLE_KEY in your host settings.",
    });
  }

  return res.status(200).json({ publishableKey: pk });
};
