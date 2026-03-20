/**
 * Stripe Embedded Checkout branding — aligned with site tokens in static/style.css
 * (--surface #16213e, --accent #53d769). Override via env for Dashboard parity / A-B tests.
 *
 * Also set branding at https://dashboard.stripe.com/settings/branding/checkout
 * (logo, colors) so hosted receipts and defaults stay consistent.
 */
function getCheckoutBrandingSettings() {
  return {
    display_name: process.env.STRIPE_CHECKOUT_DISPLAY_NAME || "DoBi",
    background_color:
      process.env.STRIPE_CHECKOUT_BACKGROUND_COLOR || "#16213e",
    button_color: process.env.STRIPE_CHECKOUT_BUTTON_COLOR || "#53d769",
    font_family: process.env.STRIPE_CHECKOUT_FONT_FAMILY || "inter",
    border_style: process.env.STRIPE_CHECKOUT_BORDER_STYLE || "rectangular",
  };
}

module.exports = { getCheckoutBrandingSettings };
