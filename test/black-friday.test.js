const { test } = require("node:test");
const assert = require("node:assert");
const { BLACK_FRIDAY, isSaleOn, withOfferCode } = require("../static/black-friday");

const START = BLACK_FRIDAY.start;
const END = BLACK_FRIDAY.end;

test("the sale window is one pair of instants", () => {
  assert.strictEqual(START, "2026-11-23T00:00:00-05:00");
  assert.strictEqual(END, "2026-12-02T05:00:00.000Z");
  assert.strictEqual(Date.parse(START), Date.parse("2026-11-23T05:00:00.000Z"));
});

test("sale is on at Detroit midnight Nov 23 and off one millisecond earlier", () => {
  assert.strictEqual(isSaleOn(new Date(START)), true);
  assert.strictEqual(isSaleOn(new Date(Date.parse(START) - 1)), false);
});

test("sale stays on through the last millisecond of Dec 1 Detroit and is off at midnight", () => {
  assert.strictEqual(isSaleOn(new Date(Date.parse(END) - 1)), true);
  assert.strictEqual(isSaleOn(new Date(END)), false);
});

test("a mid-window instant is on and a January instant is off", () => {
  assert.strictEqual(isSaleOn(new Date("2026-11-23T14:00:00Z")), true);
  assert.strictEqual(isSaleOn(new Date("2026-11-29T18:00:00Z")), true);
  assert.strictEqual(isSaleOn(new Date("2026-01-01T00:00:00Z")), false);
  assert.strictEqual(isSaleOn(new Date("2026-11-22T23:59:59-05:00")), false);
});

test("bf=on and bf=off override the clock, and now= sets the clock", () => {
  assert.strictEqual(isSaleOn(new Date("2020-01-01T00:00:00Z"), "?bf=on"), true);
  assert.strictEqual(isSaleOn(new Date(START), "?bf=off"), false);
  assert.strictEqual(isSaleOn(new Date("2020-01-01T00:00:00Z"), "?now=2026-11-23T00:00:00-05:00"), true);
  assert.strictEqual(isSaleOn(new Date(START), "?now=2026-12-02T05:00:00Z"), false);
  assert.strictEqual(isSaleOn(new Date(START), "?bf=off&now=2026-11-29T00:00:00Z"), false);
});

test("DoBi OS Gumroad links gain the offer code and keep existing params", () => {
  assert.strictEqual(
    withOfferCode("https://dobisurvival.gumroad.com/l/dobi-mac"),
    "https://dobisurvival.gumroad.com/l/dobi-mac?offer_code=BLACKFRIDAY"
  );
  assert.strictEqual(
    withOfferCode("https://dobisurvival.gumroad.com/l/welbfh?wanted=1"),
    "https://dobisurvival.gumroad.com/l/welbfh?wanted=1&offer_code=BLACKFRIDAY"
  );
  assert.strictEqual(
    withOfferCode("https://dobisurvival.gumroad.com/l/dobi-windows"),
    "https://dobisurvival.gumroad.com/l/dobi-windows?offer_code=BLACKFRIDAY"
  );
  assert.strictEqual(
    withOfferCode("https://dobisurvival.gumroad.com/l/dobi-windows-ssd"),
    "https://dobisurvival.gumroad.com/l/dobi-windows-ssd?offer_code=BLACKFRIDAY"
  );
});

test("Stripe checkout, Nitro, and other Gumroad products are left alone", () => {
  assert.strictEqual(withOfferCode("checkout.html?platform=mac"), "checkout.html?platform=mac");
  assert.strictEqual(withOfferCode("contact.html"), "contact.html");
  assert.strictEqual(
    withOfferCode("https://dobisurvival.gumroad.com/l/something-else"),
    "https://dobisurvival.gumroad.com/l/something-else"
  );
});
