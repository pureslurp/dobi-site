# dobi-site

Stripe checkout integration for Dobi products.

## Development

```bash
npm install
npm test
```

## GitHub Actions Secrets

For CI to test the Stripe integration, add these secrets to the repository:

- `STRIPE_SECRET_KEY` — Stripe test mode secret key (starts with `sk_test_`)
- `STRIPE_PRICE_SSD_MAC` — Stripe price ID for Mac SSD product (starts with `price_`)
- `STRIPE_PRICE_SSD_WINDOWS` — Stripe price ID for Windows SSD product (starts with `price_`)

The test suite will skip Stripe API calls if these secrets are not set, but will still run the zone calculation unit tests.
