/**
 * Rough US zones from Michigan fulfillment (higher zone = higher default shipping).
 * Adjust ranges or switch to carrier quotes when you outgrow this.
 *
 * @param {string} zipInput — user-entered ZIP (we normalize to 5 digits)
 * @returns {1|2|3|4}
 */
function shippingZoneFromZip(zipInput) {
  const zip = String(zipInput).replace(/\D/g, "").slice(0, 5);
  if (!/^\d{5}$/.test(zip)) {
    throw new Error("Please enter a valid 5-digit US ZIP code.");
  }

  const p3 = parseInt(zip.slice(0, 3), 10);

  if ((p3 >= 995 && p3 <= 999) || (p3 >= 967 && p3 <= 968)) {
    return 4;
  }

  if (
    (p3 >= 480 && p3 <= 499) ||
    (p3 >= 530 && p3 <= 549) ||
    (p3 >= 600 && p3 <= 629) ||
    (p3 >= 430 && p3 <= 458) ||
    (p3 >= 460 && p3 <= 479)
  ) {
    return 1;
  }

  if (
    (p3 >= 100 && p3 <= 429) ||
    (p3 >= 500 && p3 <= 529) ||
    (p3 >= 550 && p3 <= 588) ||
    (p3 >= 630 && p3 <= 678)
  ) {
    return 2;
  }

  if ((p3 >= 590 && p3 <= 599) || (p3 >= 700 && p3 <= 898)) {
    return 3;
  }

  return 4;
}

module.exports = { shippingZoneFromZip };
