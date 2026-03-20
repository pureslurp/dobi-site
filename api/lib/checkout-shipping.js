const { shippingZoneFromZip } = require("./shipping-zones");

function shippingCentsForZone(zone) {
  const key = `SHIPPING_ZONE_${zone}_CENTS`;
  const raw = process.env[key];
  if (raw != null && raw !== "") {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  const defaults = { 1: 699, 2: 899, 3: 1099, 4: 1299 };
  return defaults[zone] ?? 2000;
}

/** Real zone-based options after address is known (embedded checkout update). */
function buildShippingOptionsForZone(zone) {
  const amount = shippingCentsForZone(zone);
  return [
    {
      shipping_rate_data: {
        display_name: `Standard shipping (Zone ${zone})`,
        type: "fixed_amount",
        fixed_amount: { amount, currency: "usd" },
        tax_behavior: "exclusive",
      },
    },
  ];
}

/** Placeholder $0 option until the customer completes shipping details. */
function buildDummyShippingOptions() {
  return [
    {
      shipping_rate_data: {
        display_name: "Calculated from address",
        type: "fixed_amount",
        fixed_amount: { amount: 0, currency: "usd" },
        tax_behavior: "exclusive",
      },
    },
  ];
}

module.exports = {
  shippingZoneFromZip,
  shippingCentsForZone,
  buildShippingOptionsForZone,
  buildDummyShippingOptions,
};
