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
| `functions/api/checkout.js` | Sends the cart to Stripe (runs on Cloudflare's servers) | No |

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

The portrait product has `"deposit": 0.5`, so checkout charges 50% of the price. After you finish a piece, send the balance from your Stripe dashboard: **Invoices → Create invoice**, pick the customer, add a line like "House portrait balance" for the other half, and send it. Stripe emails them a link to pay.

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

Etsy and Faire collect and pay sales tax for you. This shop doesn't do that automatically. If you need to collect tax, you can turn on Stripe Tax (it costs extra per transaction) by adding a Cloudflare variable `STRIPE_AUTOMATIC_TAX` set to `true`, after setting it up in Stripe. Check the Pennsylvania rules for your situation, or ask an accountant.

## Prices to confirm

Sticker prices in `data/products.json` are placeholders ($4 single, $5 holographic, $10 for the sheet). Portrait prices match your Etsy listing. Change any of them to what you charge.
