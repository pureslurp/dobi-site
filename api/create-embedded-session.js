const Stripe = require("stripe");
const { baseUrl } = require("./lib/base-url");
const { buildDummyShippingOptions } = require("./lib/checkout-shipping");
const { getCheckoutBrandingSettings } = require("./lib/checkout-branding");

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

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_")) {
    return res.status(500).json({
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel.",
    });
  }

  const body = parseBody(req);
  if (!body) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const platform = body.platform;
  if (platform !== "mac") {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const priceEnv = "STRIPE_PRICE_SSD_MAC";
  const priceId = process.env[priceEnv];
  if (!priceId || !priceId.startsWith("price_")) {
    return res.status(500).json({
      error: `Missing ${priceEnv} (Stripe Price ID from Dashboard → Products).`,
    });
  }

  const origin = baseUrl();
  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded",
      line_items: [{ price: priceId, quantity: 1 }],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: buildDummyShippingOptions(),
      branding_settings: getCheckoutBrandingSettings(),
      permissions: {
        update_shipping_details: "server_only",
      },
      return_url: `${origin}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { platform },
    });

    if (!session.client_secret) {
      console.error("create-embedded-session: missing client_secret");
      return res.status(500).json({
        error: "Checkout couldn't start. Please try again in a moment.",
      });
    }

    return res.status(200).json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error("create-embedded-session:", err && err.message, err && err.code);
    return res.status(502).json({
      error: "Checkout couldn't start. Please try again in a moment.",
    });
  }
};
