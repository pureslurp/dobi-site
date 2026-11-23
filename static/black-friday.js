/* Black Friday sale for DoBi OS.
   America/Detroit is EST (UTC-5) for this whole window, so local midnight
   is 05:00 UTC. The end instant is exclusive: the sale runs through
   2026-12-01 23:59:59.999 Detroit and is off at 2026-12-02 00:00:00 Detroit.
   Static HTML stays at $69. This script rewrites prices and Gumroad links
   only while the sale is on, so no-JS keeps the regular price. */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    if (api.isSaleOn(new Date(), window.location.search)) api.applySale(document);
  }
})(function () {
  var BLACK_FRIDAY = {
    start: "2026-11-27T05:00:00.000Z",
    end: "2026-12-02T05:00:00.000Z",
    offerCode: "BLACKFRIDAY",
    listPrice: "$69",
    salePrice: "$49"
  };

  var START = Date.parse(BLACK_FRIDAY.start);
  var END = Date.parse(BLACK_FRIDAY.end);

  var OS_PATHS = {
    "/l/dobi-mac": true,
    "/l/welbfh": true,
    "/l/dobi-windows": true,
    "/l/dobi-windows-ssd": true
  };

  var URL_ATTRS = ["href", "data-mac-pc-url", "data-mac-ssd-url", "data-windows-pc-url", "data-windows-ssd-url"];

  function isSaleOn(now, search) {
    var params = new URLSearchParams(search || "");
    var force = params.get("bf");
    if (force === "on") return true;
    if (force === "off") return false;

    var instant = now instanceof Date ? now : new Date(now || Date.now());
    var override = params.get("now");
    if (override) {
      var parsed = new Date(override);
      if (!isNaN(parsed.getTime())) instant = parsed;
    }
    var time = instant.getTime();
    if (isNaN(time)) return false;
    return time >= START && time < END;
  }

  function withOfferCode(href) {
    if (!href || typeof href !== "string") return href;
    var url;
    try {
      url = new URL(href);
    } catch (err) {
      return href;
    }
    if (url.hostname !== "dobisurvival.gumroad.com") return href;
    if (!OS_PATHS[url.pathname]) return href;
    url.searchParams.set("offer_code", BLACK_FRIDAY.offerCode);
    return url.toString();
  }

  function applySale(doc) {
    var cards = doc.querySelectorAll("article");
    for (var i = 0; i < cards.length; i++) {
      var heading = cards[i].querySelector("h3");
      if (!heading || heading.textContent.replace(/\s+/g, " ").trim() !== "DoBi OS") continue;
      var price = cards[i].querySelector(".price");
      if (!price || price.textContent.trim() !== BLACK_FRIDAY.listPrice) continue;
      if (price.getAttribute("data-sale") === "black-friday") continue;
      price.setAttribute("data-sale", "black-friday");
      price.setAttribute("aria-label", "Was $69, now $49, Black Friday");
      price.innerHTML = '<s class="price-was">$69</s><span class="price-now">$49</span><span class="bf-tag">Black Friday</span>';
    }

    for (var a = 0; a < URL_ATTRS.length; a++) {
      var attr = URL_ATTRS[a];
      var nodes = doc.querySelectorAll("[" + attr + "]");
      for (var n = 0; n < nodes.length; n++) {
        var current = nodes[n].getAttribute(attr);
        var next = withOfferCode(current);
        if (next !== current) nodes[n].setAttribute(attr, next);
      }
    }
  }

  return {
    BLACK_FRIDAY: BLACK_FRIDAY,
    isSaleOn: isSaleOn,
    withOfferCode: withOfferCode,
    applySale: applySale
  };
});
