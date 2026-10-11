# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Philly locals and gift shoppers** buying Philly-themed stickers (cheesesteak, wooder ice, pork roll, football, landmarks) for themselves or as small gifts.
- **Followers of ed.mcveigh's art** who already know the work from Instagram, markets or Etsy and want to buy directly from the artist.
- **Homeowners commissioning a house portrait**, often as a gift. A considered, higher-value purchase that starts with a 50% deposit and an emailed photo of the home.

Original paintings are sold here too, but collectors were not named as a primary audience.

Stickers are the steady, consistent sellers; house portraits sell less often but are worth the most per sale. Pages can lead with portraits, but stickers must never get lost.

## Product Purpose

shop.edmcveigh.com is ed.mcveigh's own storefront: a catalog, cart and Stripe checkout with free US shipping. It exists alongside Etsy to:

- keep more of each sale (Stripe's fee only, no marketplace fees);
- be a home for the brand that feels like ed.mcveigh rather than a marketplace template;
- grow house-portrait commissions, the highest-value product;
- give Instagram and edmcveigh.com traffic somewhere the artist owns.

Success means visitors from those links buy here instead of bouncing to Etsy, and portrait commissions increase.

## Positioning

Everything is drawn, painted or inked by one Philadelphia artist and sold directly by them. The stickers are the artist's own Philly in-jokes and cat characters; the paintings are one-of-a-kind; the portraits are original pen-and-ink commissions of the buyer's own home.

## Operating Context

- Most traffic arrives from Instagram (@ed.mcveigh) and the edmcveigh.com links page (`landing/`), so phones are the common first visit.
- Etsy is the source of truth for listings. A daily GitHub Action syncs new listings, copy, photos, options and prices into `data/products.json`; shop-only fields (name, category, size line, badges, details, disclaimer, portrait deposit/steps) are kept.
- A one-of-a-kind painting sold here is deactivated on Etsy automatically via the Stripe webhook; checkout asks Etsy whether each painting is still for sale.
- Portrait flow: pay 50% deposit at checkout (phone and "deadline or notes" collected), email a photo of the home to hello@edmcveigh.com, balance invoiced through Stripe when finished. Local Philly pickup or delivery is available by email.
- Orders are fulfilled by the artist; labels via Pirate Ship. Sales tax via Stripe Tax (Pennsylvania).
- Wholesale goes through Faire; a design portfolio at design.edmcveigh.com is planned but not live.

## Capabilities and Constraints

- Static site on Cloudflare Pages: plain HTML/CSS/JS, no build step. Pages are rendered client-side by `assets/shop.js` from `data/products.json` and `config.js`. Serverless functions in `functions/api/` handle checkout, the Stripe webhook and the Etsy connection.
- Sections (from `config.js`): Stickers, Original paintings, House portraits. Products link as `#<id>`; sections as `#stickers`, `#originals`, `#portraits`.
- Product features: variants with their own prices, sold-out state, one-of-a-kind (quantity 1), badges ("New" for 30 days after import), deposit pricing, and drawn placeholders when a product has no photos.
- US shipping only, free on everything. Policies live in `data/policies.html` (shipping, returns, commissions).
- Status: pre-launch. `index.html` carries `noindex`, and the domain is not yet pointed at the shop.
- Undecided: About page copy (`data/about.html` is a placeholder); portfolio launch date.

## Brand Commitments

- Name and wordmark: **ed.mcveigh** (lowercase, with the dot).
- The logo intro animation on the front page stays (plays once per visit, skipped for reduced motion).
- Light and dark modes with a visitor toggle stay.
- Contact: hello@edmcveigh.com. Etsy: EdMcveighArt. Instagram: @ed.mcveigh.

## Evidence on Hand

- 33 real products in `data/products.json`: 20 stickers, 12 original paintings, 1 custom house portrait listing, with Etsy photos saved in `images/`.
- Brand assets in `assets/brand/` (favicons, touch icon, OG image) and `landing/brand/`.
- Sticker details carry the existing line "Drawn, designed, printed and cut by me. No AI was used."
- No testimonials, reviews, press or sales figures are in the repo. Do not invent them.

## Product Principles

1. **Buy here, not there.** Every page should make buying direct at least as easy and trustworthy as Etsy, without disparaging Etsy.
2. **The art leads.** Product imagery and the artist's hand carry the brand; interface stays out of the way of the work.
3. **Portraits get a guided path.** The commission is the biggest purchase and the least self-explanatory; its deposit, photo and timeline steps must be unmistakable.
4. **Phone first.** Most visitors arrive from Instagram on a phone.
5. **Etsy stays the source of truth.** Design must work with whatever the sync brings in: varying photo counts, long descriptions, sold-out states.
