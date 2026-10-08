# ed.mcveigh shop

The code for **shop.edmcveigh.com**: a product catalog, a cart, and Stripe checkout with free shipping.
Hosting is free on Cloudflare Pages. You pay only Stripe's fee on each sale.

## What's in this folder

| File | What it is | Do you edit it? |
|---|---|---|
| `data/products.json` | Every product: names, prices, options, sizes, photos, descriptions | **Yes, this is where you add products** |
| `images/` | Product photos | Yes, drop photos in here |
| `config.js` | Your contact email, Etsy and Instagram links, shipping banner text | Occasionally |
| `index.html` | The page shell | Rarely |
| `assets/style.css` | Colors, fonts and layout | Only to change the look |
| `assets/shop.js` | Shows the products and runs the cart | No |
| `assets/intro.js` | The ed.mcveigh logo animation (plays once per visit on the front page) | No |
| `functions/api/checkout.js` | Sends the cart to Stripe (runs on Cloudflare's servers) | No |
| `assets/brand/`, `favicon.ico`, `site.webmanifest` | Tab icon, phone home-screen icon, and the image shown when the shop link is shared | Only to change the logo |
| `landing/` | The links page for edmcveigh.com (its own small site, see below) | To change its links |
| `404.html` | The "Page not found" page for addresses that don't exist (bots probing for things like `/wp-admin` or `setup.php`) | No |

---

## Adding a product

1. **Add photos.** Put them in the `images/` folder. Use simple names without spaces, like `ninja-cat-1.jpg`, `ninja-cat-2.jpg`. Square photos about 1600×1600 look best. The first photo is the one shown in the product grid.
2. **Open `data/products.json`** in a text editor (VS Code is good, and you already have it).
3. **Copy an existing product block**, from its `{` to its matching `}`, and paste it after another product. Put a comma between blocks.
4. **Change the details:**

```json
{
  "id": "ninja-cat",
  "name": "Ninja Cat Sticker",
  "category": "stickers",
  "variantLabel": "",
  "variants": [
    { "name": "Glossy", "price": 4.00 }
  ],
  "size": "3\" wide × 2\" tall",
  "images": ["images/ninja-cat-1.jpg", "images/ninja-cat-2.jpg"],
  "swatch": "#333333",
  "soldOut": false,
  "summary": "One short line about it.",
  "description": [
    "First paragraph.",
    "Second paragraph."
  ],
  "details": [
    "Glossy laminated, waterproof, die cut",
    "Drawn, designed, printed and cut by me. No AI was used."
  ],
  "disclaimer": ""
}
```

What each line means:

- **id**: a unique short name, lowercase with dashes. It becomes the product's address: `shop.edmcveigh.com/#ninja-cat`.
- **category**: `"stickers"`, `"originals"` or `"portraits"`, which decides the section it shows up in. The sections themselves are listed in `config.js`.
- **oneOfAKind** (optional): set to `true` for originals. Buyers can only get one, and the page says "only 1 available". When it sells, set `"soldOut": true` here **and** deactivate it on Etsy, since the same painting is listed in both places.
- **variants**: the options a buyer picks from, each with its own price. One variant means no dropdown appears. For two finishes, list two:
  `[{ "name": "Glossy", "price": 4.00 }, { "name": "Holographic", "price": 5.00 }]`. Then set `"variantLabel": "Finish"`.
- **size**: shown on the card and the product page. Write it as `width × height` so the placeholder drawing gets the right shape.
- **images**: paths to your photos, or full web addresses. The imported products currently use your Etsy photo addresses (`https://i.etsystatic.com/...`). They work, but if you delete a listing on Etsy its photos disappear here too, so move them into `images/` before that happens. Leave it as `[]` and a drawn placeholder shows instead.
- **swatch**: a color (hex code) for the mat behind the product.
- **soldOut**: set to `true` to show "Sold out" and turn off the Add to cart button.
- **badge** (optional): a small label on the card, like `"Best seller"` or `"New"`.
- **disclaimer**: for team-adjacent designs, the "not affiliated" line. Use `""` for none.

5. **Check for typos.** Every quote and comma matters in this file. Paste the whole file into [jsonlint.com](https://jsonlint.com) and it will tell you the line if something's off. If the file is broken, the shop shows a "product list couldn't load" message instead of products, so you'll know right away.
6. **Publish** (see "Updating the live site" below).

Changing a price, marking something sold out or fixing a typo works the same way: edit the line, save, publish.

### House portraits and deposits

The portrait product has `"deposit": 0.5`, so checkout charges 50% of the price. After you finish a piece, send the balance from your Stripe dashboard: **Invoices → Create invoice**, pick the customer (portrait buyers are saved as customers automatically, with their address), add a line like "House portrait balance" for the other half, turn on **Collect tax automatically**, and send it. Stripe emails them a link to pay, with Pennsylvania sales tax added the same way as at checkout. To give someone a discount (friends and family, say), add a coupon on that invoice: a fixed amount off, used once. Tax is worked out after the discount.

At checkout, portrait customers are asked for their phone number and a "deadline or notes" field, and they're reminded to email you a photo of the home. Make sure `contactEmail` in `config.js` is the address you want them to use.

---

## One-time setup

### 1. Stripe

1. Sign up at [stripe.com](https://stripe.com) and fill in your business and bank details so you can get paid.
2. Go to **Developers → API keys**. Stripe starts you in **test mode**. Copy the **Secret key** (starts with `sk_test_`). You'll use the test key first, then swap in the live key (`sk_live_`) when you're ready.
3. Never put the secret key in any file in this folder. It only goes into Cloudflare's settings (step 2).

### 2. Cloudflare Pages (free hosting)

1. Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. The easiest way to publish is from GitHub, so every change you save goes live on its own:
   - Create a GitHub repository (for example `edmcveigh-shop`) and upload this whole folder to it.
   - In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, and pick the repository.
   - Build settings: Framework preset **None**, build command **blank**, output directory **`/`**.
3. After the first deploy, open the project's **Settings → Variables and secrets**, add a secret named `STRIPE_SECRET_KEY` with your test key, and redeploy.
4. Your shop is now live at an address like `edmcveigh-shop.pages.dev`.

(No GitHub? You can also drag and drop the folder in **Pages → Upload assets**, but the checkout function only works with the GitHub method or the Wrangler command-line tool.)

### 3. Point shop.edmcveigh.com at it

1. In the Cloudflare Pages project, go to **Custom domains → Set up a custom domain** and enter `shop.edmcveigh.com`. Cloudflare shows you a CNAME record to add.
2. Log in to **name.com → My Domains → edmcveigh.com → Manage DNS Records**, and add:
   - **Type:** CNAME
   - **Host:** `shop`
   - **Answer:** your `*.pages.dev` address (for example `edmcveigh-shop.pages.dev`)
3. Back in Cloudflare, it checks the record and sets up the secure (https) certificate. This usually takes a few minutes, sometimes up to a day.

This doesn't touch your main `edmcveigh.com` or `design.edmcveigh.com` records, so Squarespace keeps working until you're ready to switch.

### 4. Test, then go live

1. On the live site, add a few stickers and a portrait to the cart and check out with Stripe's test card **4242 4242 4242 4242**, any future date, any CVC and any ZIP.
2. In Stripe (test mode), open **Payments** to see the order with the shipping address and items.
3. When it all looks right, replace `STRIPE_SECRET_KEY` in Cloudflare with your **live** secret key and redeploy. That's it: you're taking real orders.

---

## Updating the live site

If you set up GitHub: edit files, then commit and push (or use GitHub's website to upload changed files). Cloudflare republishes in about a minute.

## Filling orders

- Stripe emails you on each sale (turn this on under **Settings → Notifications** if it isn't).
- In **Payments**, each order shows the items, the shipping address and any portrait notes.
- Buy labels on [Pirate Ship](https://www.pirateship.com) (free to use, discounted USPS rates), and paste the address in.

## Sales tax

Etsy and Faire collect and pay sales tax for you. This shop uses Stripe Tax: with your Pennsylvania registration added in Stripe and the Cloudflare variable `STRIPE_AUTOMATIC_TAX` set to `true`, checkout adds sales tax based on the buyer's address (Stripe charges a small fee per transaction). Everything is taxed as physical goods; shipping is free. Stripe's Tax reports show what to file.

## Prices to confirm

Sticker prices in `data/products.json` are placeholders ($4 single, $5 holographic, $10 for the sheet). Portrait prices match your Etsy listing. Change any of them to what you charge.

---

## The landing page (edmcveigh.com)

`landing/` holds the links page that will live at edmcveigh.com. Its links point at the shop's sections, plus Etsy and Faire. To change a link, edit the `LINKS` list near the bottom of `landing/index.html`.

**Preview it now:** https://edmcveigh-shop.pages.dev/landing/ (its shop links go to the preview shop while you're on a pages.dev address).

**Hosting it, when you're ready to point the domain:** create a second Cloudflare Pages project from this same GitHub repo:
- Project name: `edmcveigh-landing`
- Framework preset: None, build command blank
- **Root directory (under Advanced): `landing`**
- Build output directory: `/`

Then add `edmcveigh.com` (and `www.edmcveigh.com`) under that project's Custom domains. The root directory setting keeps the shop's checkout code out of the landing site.

---

## Etsy sync

Every morning (and whenever you press the button) a GitHub job checks your Etsy shop and keeps the shop matching it. **Etsy is the source of truth**, so make changes there, not in `products.json`:

- **New listings** are added to the shop.
- **Changes to existing listings** come across: description, tags, photos (added, removed or reordered), options and prices. Options and prices come through the Etsy connection (below); Etsy's option names are translated for the shop with `optionNames` in `data/etsy-sync.json` ("glossy waterproof" shows as "Glossy"). A product with a single option keeps the shop's name for it and only takes Etsy's price.
- **Price safety stop:** a price that moves by more than half, or a product that would drop to one option, is held back. The run shows as failed (so GitHub emails you) and says what was held; everything else still updates. If the change is right, edit `products.json` by hand.
- **New listings** also get their size from the Width and Height on the Etsy listing, and new stickers start with the standard Details lines (`newStickerDetails`). Shop-only things stay as they are: the product's name, its web address, its category, the size line, badges, details, the disclaimer, the portrait's deposit, steps and policy line, and anything listed in a product's `shopOnly` (see below).
- **A listing that's no longer active** on Etsy (sold, deactivated, out of stock or expired) shows as sold out. If it comes back on Etsy, it's available again, unless it sold through the shop.

A new product is copied exactly from Etsy: the full description, tags, every photo (saved into `images/`), the options and their prices, and which section it belongs in (from its Etsy shop section). Its name is the short start of the Etsy title, up to the first comma or "|" ("Sushi Cats Sticker, Cute Cat Gift…" becomes "Sushi Cats Sticker"); rename it in `products.json` whenever you like and the sync will leave it alone. It gets a "New" badge for 30 days.

Each product stores its Etsy listing number (`etsyListingId`), which is how the sync knows what's already here. Two safety stops: if a run finds more than 5 new listings, or would mark more than 3 products sold out at once, it stops without changing anything (raise `maxNewPerRun` or `maxSoldOutPerRun` in `data/etsy-sync.json` if that's really what happened). Photos only get replaced when every new one downloaded. Listings to never import, like the hedgehog card, are listed there too.

**Run it now:** github.com/EMcMYK/edmcveigh-shop → **Actions** → **Sync from Etsy** → **Run workflow**. The GitHub phone app has the same button. The run page lists what was added, updated or marked sold out, and the shop updates a minute later.

When a one-of-a-kind painting sells **on the shop**, Stripe tells the shop, which takes the painting off Etsy (deactivates the listing through the Etsy connection) and marks it sold on the shop. If Etsy couldn't be updated, GitHub emails you a reminder (an issue that mentions you) with a link to deactivate it by hand. Test-mode orders never touch Etsy: they check the connection and you get a "Test sale" issue instead. At checkout the shop also asks Etsy whether each painting is still for sale, so one that sold on Etsy can't sell here too.

### One-time setup

1. **Etsy keys → GitHub.** Repo → Settings → Secrets and variables → Actions → New repository secret. Add `ETSY_API_KEY` (your keystring) and `ETSY_SHARED_SECRET`. The sync also uses `ETSY_ADMIN_KEY` (see "Etsy connection") to read options and prices; without it, everything else still syncs.
2. **Run "Sync from Etsy" once** (above) and check its summary.
3. **Etsy keys → Cloudflare.** In the Pages project → Settings → Variables and secrets, add the same two as **Secrets** (for the painting check at checkout).
4. **GitHub token → Cloudflare.** Create a fine-grained token at github.com/settings/personal-access-tokens/new: only the `edmcveigh-shop` repository, permission **Actions: Read and write**, expiry 1 year. Add it to Cloudflare as the secret `GITHUB_TOKEN`. (Set yourself a reminder to replace it before it expires.)
5. **Stripe webhook.** Stripe → Developers → Webhooks → Add endpoint: URL `https://edmcveigh-shop.pages.dev/api/stripe-webhook` (change it to `https://shop.edmcveigh.com/api/stripe-webhook` once the domain is live), event **checkout.session.completed**. Copy its signing secret (`whsec_…`) into Cloudflare as `STRIPE_WEBHOOK_SECRET`. Test mode and live mode each need their own webhook.
6. **Redeploy** in Cloudflare (Deployments → Retry deployment) so the new secrets take effect.
7. Make sure GitHub emails you about @mentions: github.com/settings/notifications → Participating, @mentions and custom → Email.

Because the sync saves changes to GitHub on its own, pull the latest version before editing files on your computer.

### Etsy connection (edit access)

Reading Etsy only needs the keys above. Changing your Etsy listings from here (copy edits now, and later taking a painting off Etsy when it sells on the shop) needs your OK through Etsy's own sign-in, once. The connection lives in Cloudflare and renews itself each time it's used; if it goes unused for 90 days, connect again.

1. **Callback address in your Etsy app.** etsy.com/developers/your-apps → your app → add the callback URL `https://edmcveigh-shop.pages.dev/api/etsy/callback` (add `https://shop.edmcveigh.com/api/etsy/callback` too once that domain is live).
2. **A place to keep the connection.** Cloudflare → Storage & Databases → KV → Create a namespace named `etsy`. Then the Pages project → Settings → Bindings → Add → KV namespace: variable name `ETSY_KV`, namespace `etsy`.
3. **An admin key.** Make up a long random password (a password manager's generator is perfect). Add it as the secret `ETSY_ADMIN_KEY` in both Cloudflare (Pages project → Settings → Variables and secrets) and GitHub (repo → Settings → Secrets and variables → Actions). Cloudflare also needs `ETSY_API_KEY` and `ETSY_SHARED_SECRET` (step 3 of the setup above).
4. **Redeploy** in Cloudflare (Deployments → Retry deployment).
5. **Connect.** Open `https://edmcveigh-shop.pages.dev/api/etsy/connect?key=YOUR_ADMIN_KEY`, approve on Etsy, and you'll land on a page that says "Etsy is connected". Check it any time at `/api/etsy/status?key=YOUR_ADMIN_KEY`.

**Copy edits:** the list lives in `data/etsy-edits.json`. Actions → **Apply Etsy edits** → Run workflow, first with "Dry run" ticked (checks every listing, changes nothing), then unticked. Each run saves what Etsy had before and after to `data/etsy-edits-result.json`, and the next morning's sync brings the new text into the shop.

**Shop-only text:** a product with `"shopOnly": ["description"]` (or `"tags"`, `"options"`, `"photos"`) keeps its own version and the sync leaves it alone. The house portrait uses this, since its Etsy wording is about Etsy's checkout.
