const { test, describe } = require("node:test");
const assert = require("node:assert");
const Stripe = require("stripe");

const { shippingZoneFromZip } = require("../api/lib/shipping-zones");
const { shippingCentsForZone } = require("../api/lib/checkout-shipping");
const createSessionHandler = require("../api/create-embedded-session");
const updateShippingHandler = require("../api/update-checkout-shipping");

describe("Stripe Integration Tests", () => {
  test("fail immediately if Stripe key is not test mode", () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key) {
      assert.ok(
        key.startsWith("sk_test_"),
        "STRIPE_SECRET_KEY must start with sk_test_ (never run against live keys)"
      );
    }
  });

  describe("Zone table unit tests", () => {
    test("48201 Detroit -> Zone 1 $6.99", () => {
      const zone = shippingZoneFromZip("48201");
      assert.strictEqual(zone, 1);
      assert.strictEqual(shippingCentsForZone(zone), 699);
    });

    test("10001 NY -> Zone 2 $8.99", () => {
      const zone = shippingZoneFromZip("10001");
      assert.strictEqual(zone, 2);
      assert.strictEqual(shippingCentsForZone(zone), 899);
    });

    test("90012 LA -> Zone 4 $12.99", () => {
      const zone = shippingZoneFromZip("90012");
      assert.strictEqual(zone, 4);
      assert.strictEqual(shippingCentsForZone(zone), 1299);
    });

    test("00901 PR -> Zone 4 $12.99", () => {
      const zone = shippingZoneFromZip("00901");
      assert.strictEqual(zone, 4);
      assert.strictEqual(shippingCentsForZone(zone), 1299);
    });
  });

  describe("Stripe API integration tests", () => {
    const hasCredentials =
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") &&
      process.env.STRIPE_PRICE_SSD_MAC;

    if (!hasCredentials) {
      test.skip("skipping integration tests (missing test credentials)", () => {
        console.log(
          "⚠️  Skipping Stripe API integration tests: STRIPE_SECRET_KEY or STRIPE_PRICE_SSD_MAC not set"
        );
      });
      return;
    }

    test("create session via handler, update shipping for multiple ZIPs, verify metadata", async () => {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-03-25.dahlia",
      });

      let sessionId;

      try {
        const createReq = {
          method: "POST",
          body: { platform: "mac" },
          headers: { "user-agent": "stripe-ci-test" },
        };

        const createRes = {
          _statusCode: 200,
          _headers: {},
          _body: null,
          setHeader(key, value) {
            this._headers[key] = value;
          },
          status(code) {
            this._statusCode = code;
            return this;
          },
          json(data) {
            this._body = data;
            return this;
          },
          end() {
            return this;
          },
        };

        await createSessionHandler(createReq, createRes);

        assert.strictEqual(createRes._statusCode, 200, "create session should return 200");
        assert.ok(createRes._body?.clientSecret, "should return clientSecret");

        const clientSecret = createRes._body.clientSecret;
        sessionId = clientSecret.split("_secret_")[0];

        assert.ok(sessionId.startsWith("cs_"), "session id should start with cs_");

        const testCases = [
          { zip: "48201", zone: 1, cost: 699 },
          { zip: "90012", zone: 4, cost: 1299 },
          { zip: "48201", zone: 1, cost: 699 },
        ];

        for (const { zip, zone, cost } of testCases) {
          const updateReq = {
            method: "POST",
            body: {
              checkout_session_id: sessionId,
              shipping_details: {
                name: "Test Customer",
                address: {
                  line1: "123 Test St",
                  city: "Test City",
                  state: "MI",
                  postal_code: zip,
                  country: "US",
                },
              },
            },
            headers: { "user-agent": "stripe-ci-test" },
          };

          const updateRes = {
            _statusCode: 200,
            _headers: {},
            _body: null,
            setHeader(key, value) {
              this._headers[key] = value;
            },
            status(code) {
              this._statusCode = code;
              return this;
            },
            json(data) {
              this._body = data;
              return this;
            },
            end() {
              return this;
            },
          };

          await updateShippingHandler(updateReq, updateRes);

          assert.strictEqual(
            updateRes._statusCode,
            200,
            `update shipping for ${zip} should return 200`
          );
          assert.strictEqual(
            updateRes._body?.ok,
            true,
            `update should succeed for ${zip}`
          );

          const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["line_items"],
          });

          assert.strictEqual(
            session.metadata.quoted_zip,
            zip,
            `quoted_zip should be ${zip}`
          );
          assert.strictEqual(
            session.metadata.shipping_zone,
            String(zone),
            `shipping_zone should be ${zone}`
          );

          assert.ok(
            session.shipping_options && session.shipping_options.length > 0,
            "should have shipping options"
          );

          const shippingCost = session.shipping_options[0]?.shipping_amount;
          assert.strictEqual(
            shippingCost,
            cost,
            `shipping cost should be ${cost} cents for zone ${zone}`
          );

          const lineItems = session.line_items?.data;
          assert.ok(lineItems && lineItems.length > 0, "should have line items");

          const productAmount = lineItems[0]?.amount_total || 0;
          const expectedTotal = productAmount + cost;
          assert.strictEqual(
            session.amount_total,
            expectedTotal,
            `amount_total should be ${expectedTotal} (product ${productAmount} + shipping ${cost})`
          );
        }
      } finally {
        if (sessionId) {
          try {
            await stripe.checkout.sessions.expire(sessionId);
          } catch (err) {
            console.error("Failed to expire test session:", err.message);
          }
        }
      }
    });
  });
});
