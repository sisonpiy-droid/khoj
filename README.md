# Khoj — one search, every quick-commerce app

Compares Blinkit, Zepto and Instamart for a single search or a multi-item
grocery list, and recommends the cheapest realistic way to buy the whole
basket.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. No API key is required — it runs on a mock
provider by default (see below).

## The data source: QuickCommerce API

Live product data was scoped against the real docs at
[quickcommerceapi.com/docs](https://quickcommerceapi.com/docs):

- **Auth**: `X-API-Key` header. 100 free credits on signup, no card required.
- **Endpoint used**: `GET /v1/search?q=&lat=&lon=&platform=` (1 credit per
  platform per call). Platform identifiers: `BlinkIt`, `Zepto`, `Swiggy`
  (this is Instamart's grocery catalogue, distinct from Swiggy food delivery).
- **Confirmed fields**: name, brand, price (`offer_price`), MRP, availability,
  inventory count (location-specific), image, deeplink (real product URL),
  rating, and delivery ETA (`platform.sla`, e.g. `"8 mins"`).
- **Not provided, anywhere in the schema**: delivery fees, platform fees, or
  handling charges. This is why the basket optimizer always labels its totals
  as estimates — there is no fee data to add on top of item prices.
- **Location**: the API takes `lat`/`lon`, not pincode, for Blinkit/Zepto/
  Instamart. Khoj resolves the user's pincode to coordinates via India Post
  (validation) + OpenStreetMap Nominatim (geocoding) in `lib/location.ts` —
  a centroid approximation, since q-commerce inventory is hyperlocal.
- **Discount**: not a separate field; the UI derives it from `mrp` vs
  `offer_price` when `mrp` is higher.

No API key was available when this was first built, so `lib/providers/
quickcommerce.ts` was written against the documented schema behind a mock
provider by default. It has since been **live-tested against a real trial
key** — set `QUICKCOMMERCE_API_KEY` in `.env.local` to turn it on, no other
code changes needed (see `lib/providers/index.ts`).

Live traffic surfaced real catalogue quirks the docs didn't fully cover, all
fixed in `lib/matching/normalize.ts`:
- Quantities commonly use `"ltr"` (e.g. `"1 ltr"`), not just `"l"`/`"litre"` —
  the original regex missed it entirely, which would have silently broken
  quantity matching for most milk products.
- Some listings are wholesale multipacks (`"1 ltr x 12"`, `"2 x 200 ml"`).
  Treating the per-unit size as the product's quantity would make a 12-unit
  case look identical to a single 1L pack — quantity parsing now multiplies
  through so multipacks correctly fail to match a single-unit query instead
  of misrepresenting price-per-unit.
- Delivery ETA (`platform.sla`) isn't always a duration — a real response
  had `"sla": "Temp Closed"`. The parser already only extracts a number if
  one is present, so this correctly renders as "ETA unavailable" rather than
  crashing or fabricating a time.
- A live search also demonstrated the required resilience: one Zepto request
  timed out mid-search, and the app still returned complete results for the
  other two platforms plus a best-effort optimized basket, with the timeout
  surfaced as a visible warning rather than failing the whole search.

## Architecture

```
app/
  page.tsx              search UI, basket UI, all client state
  api/search/route.ts   server-side orchestration (the only place that talks to providers)
lib/
  providers/
    types.ts (in /types) — the Provider interface every integration implements
    quickcommerce.ts    — shared HTTP client for the real API
    blinkit.ts / zepto.ts / instamart.ts — thin adapters (platform + client)
    mock.ts              — same interface, deterministic fake data
    index.ts             — picks mock vs real per env
  search/parseQuery.ts   — natural-language query -> [{term, count}], no LLM
  matching/
    normalize.ts         — brand/quantity/variant extraction
    match.ts             — per-platform candidate ranking + cross-platform
                            equivalence clustering (deterministic, no LLM)
  optimization/basket.ts — cheapest-per-platform vs. split-basket optimizer
  location.ts            — pincode -> lat/lon
  cache.ts                — short-TTL cache + in-flight de-dup (credit control)
data/
  mockGroceryLexicon.ts  — sample data for the MOCK PROVIDER ONLY, not a catalogue
  knownBrands.ts         — brand-name/alias lexicon used by the matching layer
types/index.ts           — shared domain types
```

Adding a fourth platform means writing one adapter file that implements
`Provider` and adding it to `lib/providers/index.ts` — search, matching and
optimization are all platform-count-agnostic.

## Matching, without an LLM

Products are compared using brand + quantity (converted to a common unit) +
variant tags, not string similarity — a 500ml pack never matches a 1L pack,
and Coke never matches Coke Zero. Variant tags are split into "hard" (zero,
diet — mutually exclusive, must match exactly) and "soft" (toned, full
cream — descriptive; one platform omitting the word doesn't block a match).
This is what lets "Amul Taaza Toned Milk 1L" (Blinkit), "Amul Taaza Milk
1000ml" (Zepto) and "Amul Taaza Homogenised Toned Milk 1L" (Instamart) all
cluster as the same product. There's no LLM call in this build — the
deterministic rules cover the required cases; an LLM fallback for ambiguous
cases would be the natural next step, not implemented here to avoid adding a
dependency the MVP doesn't need yet.

## What's honest vs. estimated

- ETA: shown only if the provider returns one; otherwise "ETA unavailable".
- Deeplinks: only ever the provider's real link, or (mock mode) a real
  search-results URL on the platform for that query — never a fabricated
  product URL.
- Basket totals: always labeled estimates, because delivery/platform fees
  aren't in the data source.
- "Cheapest"/"fastest" badges only appear when there's actual price/ETA data
  to back the claim.

## Known limitations (MVP scope)

- Query parsing is heuristic (comma/"and" splitting, leading-phrase
  stripping, quantity prefixes) — no LLM, so unusual phrasings may not split
  the way a human would.
- Pincode → coordinates is a centroid approximation via a free geocoder, not
  the platform's own hyperlocal resolution.
- No cart/checkout integration — by design, per spec (search → compare →
  optimize → open product on the platform).
