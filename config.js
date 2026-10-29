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
    { id: "originals", title: "Original paintings", note: "One-of-a-kind art",
      ships: "Ships in 2–4 business days", returns: "30-day returns" },
    { id: "prints", title: "Art prints", note: "Prints of my paintings, signed by me",
      ships: "Ships in 2–4 business days" },
    { id: "portraits", title: "House portraits", note: "Original 8×10 pen and ink",
      feature: true, cta: "Commission a portrait" }
  ]
};
