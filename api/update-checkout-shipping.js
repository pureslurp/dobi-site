const Stripe = require("stripe");
const {
  shippingZoneFromZip,
  buildShippingOptionsForZone,
} = require("./lib/checkout-shipping");

const US_MSG = "We only ship to addresses in the United States.";
const ZIP_MSG = "Please enter a valid 5-digit US ZIP code.";
const UPDATE_FAIL_MSG =
  "We couldn't update shipping for that address. Check your ZIP code and try again.";

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

function getAddress(shippingDetails) {
  if (!shippingDetails || typeof shippingDetails !== "object") {
    return null;
  }
  const addr = shippingDetails.address || null;
  return addr && typeof addr === "object" ? addr : null;
}

function postalCodeFromShipping(shippingDetails) {
  const addr = getAddress(shippingDetails);
  if (!addr) return null;
  const raw =
    addr.postal_code || addr.postalCode || addr.zip || "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(0, 5);
  if (digits.length > 0) return digits;
  return null;
}

function countryFromShipping(shippingDetails) {
  const addr = getAddress(shippingDetails);
  if (!addr) return "";
  const c = addr.country || addr.country_code || "";
  return String(c).trim().toUpperCase();
}

/** Stripe API expects snake_case address fields. */
function normalizeShippingDetailsForStripe(shippingDetails) {
  if (!shippingDetails || typeof shippingDetails !== "object") {
    return shippingDetails;
  }
  const a = shippingDetails.address;
  if (!a || typeof a !== "object") {
    return shippingDetails;
  }
  return {
    name: (shippingDetails.name && String(shippingDetails.name).trim()) || "Customer",
    address: {
      line1: a.line1 || "",
      line2: a.line2 || undefined,
      city: a.city || undefined,
      state: a.state || undefined,
      postal_code: a.postal_code || a.postalCode || "",
      country: String(a.country || a.country_code || "US")
        .trim()
        .toUpperCase(),
    },
  };
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
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !secret.startsWith("sk_")) {
    return res.status(500).json({
      ok: false,
      error: "Stripe is not configured. Set STRIPE_SECRET_KEY in Vercel.",
    });
  }

  const body = parseBody(req);
  if (!body) {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  const sessionId =
    body.checkout_session_id ||
    body.checkoutSessionId ||
    body.checkout_sessionId;

  if (
    !sessionId ||
    typeof sessionId !== "string" ||
    !sessionId.startsWith("cs_")
  ) {
    return res.status(400).json({
      ok: false,
      error: UPDATE_FAIL_MSG,
    });
  }

  const shippingDetails =
    body.shipping_details || body.shippingDetails;

  if (!shippingDetails || typeof shippingDetails !== "object") {
    return res.status(400).json({ ok: false, error: ZIP_MSG });
  }

  const country = countryFromShipping(shippingDetails);
  if (country && country !== "US") {
    return res.status(400).json({ ok: false, error: US_MSG });
  }

  const postal = postalCodeFromShipping(shippingDetails);
  if (!postal || postal.length !== 5) {
    return res.status(400).json({ ok: false, error: ZIP_MSG });
  }

  let zone;
  try {
    zone = shippingZoneFromZip(postal);
  } catch (e) {
    const msg = e && e.message ? e.message : ZIP_MSG;
    return res.status(400).json({ ok: false, error: msg });
  }

  const shippingOptions = buildShippingOptionsForZone(zone);
  const stripe = new Stripe(secret);
  const detailsForStripe = normalizeShippingDetailsForStripe(shippingDetails);

  try {
    const existing = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = {
      ...(existing.metadata && typeof existing.metadata === "object"
        ? existing.metadata
        : {}),
      quoted_zip: postal,
      shipping_zone: String(zone),
    };

    await stripe.checkout.sessions.update(sessionId, {
      collected_information: {
        shipping_details: detailsForStripe,
      },
      shipping_options: shippingOptions,
      metadata,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(
      "update-checkout-shipping:",
      err && err.message,
      err && err.code
    );
    return res.status(502).json({ ok: false, error: UPDATE_FAIL_MSG });
  }
};
