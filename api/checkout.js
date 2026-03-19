const Stripe = require("stripe");
const { shippingZoneFromZip } = require("./lib/shipping-zones");

function baseUrl() {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function shippingCentsForZone(zone) {
  const key = `SHIPPING_ZONE_${zone}_CENTS`;
  const raw = process.env[key];
  if (raw != null && raw !== "") {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  const defaults = { 1: 800, 2: 1200, 3: 1600, 4: 2000 };
  return defaults[zone] ?? 2000;
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

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const zip = body && body.zip;
  const platform = body && body.platform;

  if (platform !== "mac" && platform !== "linux") {
    return res.status(400).json({ error: "Invalid platform" });
  }

  const priceEnv =
    platform === "mac" ? "STRIPE_PRICE_SSD_MAC" : "STRIPE_PRICE_SSD_LINUX";
  const priceId = process.env[priceEnv];
  if (!priceId || !priceId.startsWith("price_")) {
    return res.status(500).json({
      error: `Missing ${priceEnv} (Stripe Price ID from Dashboard → Products).`,
    });
  }

  let zone;
  try {
    zone = shippingZoneFromZip(zip);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Invalid ZIP" });
  }

  const amount = shippingCentsForZone(zone);
  const origin = baseUrl();

  const stripe = new Stripe(secret);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: `Standard shipping (Zone ${zone})`,
            type: "fixed_amount",
            fixed_amount: { amount, currency: "usd" },
            tax_behavior: "exclusive",
          },
        },
      ],
      success_url: `${origin}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/index.html#pricing`,
      metadata: {
        quoted_zip: String(zip).replace(/\D/g, "").slice(0, 5),
        shipping_zone: String(zone),
        platform,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    const msg =
      err && err.message ? err.message : "Could not start checkout";
    return res.status(502).json({ error: msg });
  }
};
