// Shop settings you might want to change. The website reads this file.
window.SHOP_CONFIG = {
  // Shown on the site so portrait customers know where to send their house photos.
  contactEmail: "hello@edmcveigh.com",

  // Links shown in the footer.
  etsyUrl: "https://www.etsy.com/shop/EdMcveighArt",
  instagramUrl: "https://www.instagram.com/ed.mcveigh",

  // The contact form sends through Web3Forms (web3forms.com). Paste the access key they email you
  // here. Until then, the form's Send button opens the visitor's email app instead.
  contactFormKey: "64e0fe1c-738f-4690-8a84-5561d1917d16",

  // Text shown in the banner and cart.
  shippingNote: "Free US shipping on everything",

  // The wholesale page (shop.edmcveigh.com/#wholesale, also edmcveigh.com/wholesale) for shops that
  // want to carry the stickers. It lists every sticker that has a "faireUrl" in products.json.
  // Keep these matching what's set on Faire.
  //   prices:   wholesale price of each product by its id; "default" covers the rest.
  //   minimums: a product whose minimum differs from "minimumPerDesign", by its id.
  //   terms:    the lines in the box at the top, in plain words.
  //   catalogPdf: the catalog PDF to download (put the file in wholesale/), or "" for no button.
  wholesale: {
    faireUrl: "https://www.faire.com/direct/edmcveighart",
    prices: { default: 2.00, "its-a-philly-thing-sheet": 3.50 },
    minimumPerDesign: 10,
    minimums: { "its-a-philly-thing-sheet": 6 },
    terms: [
      ["Wholesale", "$2 each for single stickers. $3.50 for the It's A Philly Thing Sticker Sheet (9 stickers on one sheet)"],
      ["Suggested retail", "$3.99 each for single stickers. $6.99 for the It's A Philly Thing Sticker Sheet"],
      ["Minimums", "10 of each single sticker design, 6 of the It's A Philly Thing Sticker Sheet, $60 per order"],
      ["Finishes", "Every design comes in your choice of Glossy or Holographic glitter, same price"]
    ],
    catalogPdf: ""
  },

  // Shop sections, in the order they appear. Each product's "category" must match one of these ids.
  //   groups:  splits a section into smaller groups by product name (a regular expression);
  //            anything that matches no group goes first, under "otherTitle".
  //   feature: shows the section as a big feature near the top of the front page instead of a
  //            grid at the bottom, with "cta" as its button.
  //   ships, returns: shown under the buy button on that section's products (keep them matching
  //            data/policies.html).
  categories: [
    { id: "stickers", title: "Stickers", note: "Waterproof, die cut, glossy or holographic",
      otherTitle: "Philly", groups: [{ title: "Cats", match: "\\bcats?\\b" }],
      ships: "Ships in 2–4 business days" },
    { id: "originals", title: "Original art", note: "One-of-a-kind paintings, and signed prints",
      otherTitle: "Originals", groups: [{ title: "Prints", match: "\\bprints?\\b" }],
      ships: "Ships in 2–4 business days", returns: "30-day returns" },
    { id: "portraits", title: "House portraits", note: "Original 8×10 pen and ink",
      feature: true, cta: "Commission a portrait" }
  ]
};
