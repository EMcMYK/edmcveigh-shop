---
name: ed.mcveigh shop
description: One ink, cream paper, sturdy outlines. The storefront and links page for a Philadelphia artist.
colors:
  fairmount-green: "#18602a"
  fairmount-green-soft: "#4f7a58"
  paper-cream: "#fcf8ec"
  mat-tint: "#f1f1e0"
  hairline: "#d9e3d2"
  brick-error: "#a3361f"
  water-ice-blue: "#86d8ef"
  water-ice-soft: "#79b3c7"
  oxblood-night: "#2b0610"
  oxblood-mat: "#3a0d19"
  oxblood-line: "#4a2230"
  error-dark: "#ffb4a3"
typography:
  display:
    fontFamily: "Agbalumo, Cooper Black, Georgia, serif"
    fontSize: "clamp(46px, 8.8vw, 76px)"
    fontWeight: 400
    lineHeight: 1.05
  headline:
    fontFamily: "Agbalumo, Cooper Black, Georgia, serif"
    fontSize: "clamp(30px, 4.4vw, 44px)"
    fontWeight: 400
    lineHeight: 1.08
  title:
    fontFamily: "Agbalumo, Cooper Black, Georgia, serif"
    fontSize: "clamp(26px, 4vw, 34px)"
    fontWeight: 400
    lineHeight: 1.1
  body:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  body-strong:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  price:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    fontFeature: "tnum"
  label:
    fontFamily: "Instrument Sans, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.07em"
rounded:
  tag: "2px"
  base: "4px"
spacing:
  edge: "clamp(16px, 4vw, 56px)"
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "26px"
  xl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.fairmount-green}"
    textColor: "{colors.paper-cream}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.base}"
    padding: "12px 22px"
  button-secondary:
    backgroundColor: "{colors.paper-cream}"
    textColor: "{colors.fairmount-green}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.base}"
    padding: "12px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.mat-tint}"
    textColor: "{colors.fairmount-green}"
  header-button:
    backgroundColor: "{colors.paper-cream}"
    textColor: "{colors.fairmount-green}"
    rounded: "{rounded.base}"
    height: "44px"
  header-button-hover:
    backgroundColor: "{colors.fairmount-green}"
    textColor: "{colors.paper-cream}"
  badge:
    backgroundColor: "{colors.fairmount-green}"
    textColor: "{colors.paper-cream}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  select-field:
    backgroundColor: "{colors.paper-cream}"
    textColor: "{colors.fairmount-green}"
    rounded: "{rounded.base}"
    padding: "11px 44px 11px 14px"
  product-mat:
    backgroundColor: "{colors.mat-tint}"
    rounded: "{rounded.base}"
  notice:
    backgroundColor: "{colors.mat-tint}"
    textColor: "{colors.fairmount-green}"
    rounded: "{rounded.base}"
    padding: "10px 12px"
---

# Design System: ed.mcveigh shop

## Overview

**Creative North Star: "The Inked Sticker Sheet"**

Every surface is a sheet of cream paper printed in one ink. Products, buttons, menus and fields are outlined in that same ink at a steady 2px, the way a die-cut sticker carries its own border, so the page reads as a set of shapes laid out on a sheet. The art, meaning the photos of stickers, paintings and portraits, provides all the color. The interface provides only ink, paper and outline.

The two modes are two print runs of the same sheet. In light mode Fairmount Green ink sits on Paper Cream. In dark mode Water Ice Blue sits on Oxblood Night. Neither mode is the "real" one: each has exactly one ink, and every token flips together. Density is relaxed but not airy: a 1120px column, generous product thumbnails, and short runs of copy.

Components are sturdy and plain. Thick outlines, square-ish corners and solid fills say "this is a real shop that works" without competing with the work. The one flourish is the brand itself: the Agbalumo headings and the tilted "e." wordmark, which the logo intro animates on the front page. The shop must never drift toward slick minimal luxury: no thin serifs, no stark white, no black buttons, no fashion-brand coolness.

**Key Characteristics:**
- One ink color per mode, used for type, outlines, fills and focus rings.
- 2px ink outlines on everything you can touch.
- Agbalumo for headings and the wordmark only; Instrument Sans for everything else.
- Small, nearly square corners (4px) throughout.
- Flat at rest, with a faint shadow; on hover, controls rise a few pixels and the shadow grows.
- Product photos sit on a quiet tinted mat, square in grids, uncropped on product pages.

## Colors

One ink on one paper per mode, with a single quiet tint and a hairline. Nothing else.

### Primary
- **Fairmount Green** (light-mode ink): lettering, every outline, solid buttons, the banner, badges, the cart count and focus rings. 7.2:1 on Paper Cream.
- **Water Ice Blue** (dark-mode ink): takes over every job Fairmount Green does. 11.5:1 on Oxblood Night.

### Neutral
- **Paper Cream** (light page): the page, the header, the drawer, and text on ink fills.
- **Oxblood Night** (dark page): the same jobs in dark mode.
- **Mat Tint / Oxblood Mat**: the background behind product photos and drawn placeholders, notice boxes, thumbnail wells and quiet hover fills.
- **Hairline / Oxblood Line**: idle thumbnail borders and other low-emphasis separators that should not compete with the ink outlines.
- **Fairmount Green Soft / Water Ice Soft**: secondary text such as section descriptions, card meta, field labels, fine print, the back link and the footer. 4.65:1 on Paper Cream.

### Feedback
- **Brick Error / Error Dark**: error messages only, as the border and text of a notice box. Never used for decoration or prices.

### Named Rules
**The One Ink Rule.** Each mode has exactly one ink. Interface color never goes beyond ink, paper, tint, hairline and the soft ink. Photos bring all other color. A second accent is a new design decision, not a tweak.

**The Paired Flip Rule.** Every token is defined for both modes on `:root` and `:root[data-mode="dark"]`. A component that hard-codes a light-mode hex is broken in dark mode. The one intentional exception is the drawn placeholders' sticker and portrait paper, which stay white because they depict physical objects.

## Typography

**Display Font:** Agbalumo (with Cooper Black, Georgia)
**Body Font:** Instrument Sans (with system-ui, -apple-system, Segoe UI)

**Character:** A chunky, soft, hand-lettered display face against a clean, slightly technical sans. Agbalumo carries the voice; Instrument Sans does the work and stays out of the way.

### Hierarchy
- **Display** (front-page greeting): the largest moment, balanced wrap.
- **Headline** (product name on the product page; the policies and thanks pages use the same treatment).
- **Title** (section headings such as "Stickers", the cart drawer heading, the mobile menu labels at 24px).
- **Body** (descriptions, policies): 16px at 1.55. Long Etsy descriptions are kept within 62ch, policies within 68ch, and the front-page intro within 54ch at 17px.
- **Body Strong** (card titles, nav links, buttons): weight 600, with 700 on solid buttons.
- **Price** (product page 24px; cards and cart lines at body size): weight 700 with tabular figures, so prices line up.
- **Label** (field labels, small headings inside prose, policy section heads, badges): 11 to 13px, weight 700, uppercase, tracked 0.06 to 0.08em, usually in the soft ink.

### Named Rules
**The Display Is the Voice Rule.** Agbalumo is used only for headings, menu labels and the wordmark, always at weight 400. It is never used for body copy, buttons, prices or labels.

**The Tabular Money Rule.** Every price, quantity and count uses tabular figures.

## Layout

A single centred column, max 1120px, with a responsive side margin (`spacing.edge`, 16px on phones to 56px on wide screens). The header is sticky and 64 to 76px tall. A full-width ink banner sits above it ("Free US shipping on everything").

- **Front page:** the shop name as the heading (so visitors always know where they are), an intro line, section chips, the house-portrait feature, then stickers and paintings. Portraits lead, but the Stickers chip sits on the first phone screen, because stickers are the steady sellers. Stickers are split into groups by name (Philly, then Cats) from `config.js`, with chips under the section heading to jump between groups.
- **Sections** open with a heading row, title on the left and a short soft-ink description on the right, closed by a 2px ink rule. Sections are 32px apart.
- **Product grid:** auto-fill columns at least 210px wide with 26px row and 22px column gaps. At 480px and below it is exactly two columns with 20px and 12px gaps, because most visitors are on phones.
- **Product page:** gallery and info side by side (1.1 to 1 ratio) with a gap of 24 to 56px. It stacks into one column at 640px and below. A "More stickers" (or paintings) row of four cards ends every product page, the product's own group first.
- **Navigation:** at 821px and up, section links sit in the header bar. At 820px and below they move into a drop-down menu panel behind a menu button (sections, About, Contact; the logo is the way home).
- **Cart:** a right-hand drawer, up to 420px wide, full width on phones, over a dark scrim.
- **Safe areas:** the header, drawer, phone buy bar and skip button respect `env(safe-area-inset-*)` for notched phones.

## Elevation & Depth

Surfaces are flat with one faint ambient shadow on interactive objects. On hover or keyboard focus, buttons and product frames move up 2 to 4px and the shadow deepens. That is a hover effect only. It carries no layering meaning, and nothing sits permanently raised. Real layering is limited to the overlays: the menu panel, the cart drawer and the phone buy bar.

### Shadow Vocabulary
- **Rest** (`0 2px 4px var(--shadow)`): product frames, solid buttons, menu-panel items.
- **Lift** (`0 10px 18px -6px var(--shadow-lift)`): the hover and focus state of the above.
- **Drawer** (`-10px 0 30px var(--shadow)`): the cart drawer's left edge.
- **Menu drop** (`0 14px 24px -12px var(--shadow-lift)`): under the mobile menu panel.

The shadow colors are ink-tinted in light mode (green at 16% and 32%) and black at 35% and 55% in dark mode.

### Named Rules
**The Hover-Only Lift Rule.** Controls move only in response to hover or keyboard focus, always with the same easing (`cubic-bezier(.2,.7,.2,1)`, about 0.2s). Every lifting control has an invisible 6px strip below it that still counts as hovering, so a pointer resting on its bottom edge doesn't make it jitter.

## Shapes

Nearly square. Every container, button, field, photo frame and notice box uses a 4px radius (`rounded.base`). Badges and the cart count use 2px (`rounded.tag`). The ink outline is 2px everywhere you can interact. Quieter dividers inside the cart use thinner strokes mixed from the ink (1.5px at 60%, 1px at 10%). Product thumbnails are always square in grids and cart lines. Product pages show paintings at their natural proportions.

The drawn placeholders are the one place with soft, organic shapes: a white-bordered, rounded, slightly tilted sticker (rotated -4deg), or a white portrait card with an inner ink frame.

## Components

### Buttons
Sturdy and plain: a solid block of ink that lifts.
- **Shape:** gently squared (4px), 2px ink border.
- **Primary:** ink fill, paper text, weight 700, 12px by 22px padding, at least 180px wide and stretching to fill its row. Used for Add to cart, Checkout and "Pay 50% deposit".
- **Hover / Focus:** rises 3px and the shadow changes from Rest to Lift. Pressed: rises only 1px. Disabled: 45% opacity, flat, no lift.
- **Secondary:** paper fill, ink text, weight 600, no shadow. Hover fills with the tint. Used for the quieter second action next to a primary.
- **Header buttons** (dark-mode toggle, cart, menu): 44px tall, outlined, transparent. On hover or focus they fill with ink, the text turns paper color and the button lifts 2px. The cart count is a small 2px-radius ink tile that inverts on hover.

### Product Card
- **Frame:** a square photo mat with a 2px ink outline, 4px radius and the Rest shadow. On hover the frame lifts 4px.
- **Body:** title (Body Strong), then meta (13px soft ink), then price (700, tabular).
- **Badge:** an uppercase ink tag pinned 10px from the top-left of the frame (for example "New").
- **Sold out:** the mat goes 85% greyscale at 60% opacity. The card stays in place. A sold one-of-a-kind reads "Sold · found a home" (the second part in soft ink); restockable items say "Sold out".

### Inputs / Fields
- **Select:** paper fill, 2px ink border, 4px radius, weight 500. The custom chevron is drawn from two ink strokes and sits as far in from the right edge as the text does from the left.
- **Focus:** the border thickens by adding an inner 1px ink ring. No second outer ring.
- **Label:** Label style in soft ink, above the field.
- **Quantity stepper:** an outlined box with − and + buttons and a tabular count; hover fills the button with the tint.

### Navigation
- **Desktop:** Body Strong links in ink. Hover and the current page show a 2px ink underline drawn as a bottom border.
- **Mobile menu panel:** stacked outlined cards with a Title-style label, a soft sub-line and an arrow. Hover and the current page fill with ink.
- **Back link:** small soft-ink "← Everything" that darkens to full ink on hover.

### Notices
- **Notice box:** tint fill, 2px ink border, 14px text. The error variant swaps border and text to the error color.

### Section Chips
Outlined 44px-tall links under the front-page intro, one per grid section, with no counts. They fill with ink and lift 2px on hover, and scroll to their section. A section shown as a feature gets no chip, because the feature sits right below.

### Portrait Feature (signature)
A wide outlined card near the top of the front page. On the left is the tint mat with a real finished drawing laid on it like a print: white paper border, tilted -2deg, soft paper shadow. On the right are a Headline-size title, the summary, "From $185 · 50% deposit to start" and a solid button. The whole card lifts 4px on hover, and the print straightens to 0deg. Below tablet width (767px and under) it stacks: the drawing on top, large, then the words, with a full-width button.

### Option Buttons
When a product's options are combinations ("Pen & ink only, framed"), each part becomes its own question under an uppercase label. The included choice comes first and add-ons read as actions with their price ("Pen & ink only" / "Add watercolor +$40", "No frame" / "Add a frame +$25", from the product's `choiceLabels`). A line under the price explains it: "$185 for a pen & ink portrait. Watercolor and a frame are optional add-ons." before choosing, then the sum ("$185 pen & ink portrait + $40 watercolor + $25 frame = $250"). Every button is the same size, in equal columns, 48px tall. Labels never wrap: as soon as any label would, all the buttons go one per row (measured against the column, so the narrow two-column layout stacks too). All start as outlines with nothing pre-picked; the chosen one gets a light ink wash (16% ink on paper) and a check that draws itself in, so it never competes with the solid buy button. Until every question is answered the price shows the range, and pressing the buy button marks the unanswered questions ("choose one" in the error color) instead of guessing. On stacked layouts the questions and buy button (only) sit slightly in from the page edges. Simple option lists stay a select.

### Steps Strip
For commissions, directly under the buy button: a tint box with a 2px ink outline, a Label heading, and numbered steps with 26px ink number tiles. A hairline separates a closing note in full ink, never soft ink, because it sits on the tint.

### Trust Line
A 13px soft-ink row under the buying details, separated by middots: free US shipping, secure checkout with Stripe, sold and shipped by me. The Etsy shop is linked only from the footer and About, never next to a buy button.

### Price Framing
A deposit product says its price one way everywhere: the total, then what's due today. Before options are picked: "From $185" and "50% today, the rest when it's finished" (bar: "From $185 · 50% today"). After: "$210", "$105 today, the rest when it's finished", button "Add deposit to cart – $105", bar "$210 · $105 today". Option buttons show what a choice adds ("+$40").

### Folded Sections
Description sections listed in a product's `collapse` (the portrait's "For realtors") start closed: a Label-style heading between hairlines with a +/− in ink.

### About Strip
The front page ends with an outlined card linking to About: a square photo of the drafting tools, "Who makes all this" in Title type, one line in the artist's voice and a "Read the story" link. Lifts on hover like a product card.

### Phone Buy Bar
At 640px and below, a paper bar fixed to the bottom with a 2px ink top edge. It shows the name and price and has a solid button, and appears only while the real buy button and the footer are off screen, and never while the menu is open. With options (a menu on stickers and paintings, questions on the portrait) it says "Choose finish" (or the option name) and scrolls to them without opening the menu. Once the portrait questions are answered it becomes "Check out": straight to Stripe when that's the only thing in the cart, otherwise it opens the cart first.

### Contact Flow
The header's Contact opens a page that asks one thing at a time, like the portfolio's contact page, in the shop's own style: outlined option cards that fill with ink when picked (topic: order, house portrait, wholesale, something else), a follow-up where it helps, a message, name and email, then a review with Change links and Send. A thin ink progress line shows the step. Messages send through Web3Forms (`contactFormKey` in config.js); without a key, Send opens the visitor's email app. A failed send keeps everything and offers a retry or the email address. The form carries text only: choosing "Sending photos of the home" leads to a short "Photos go by email" note with an "Email your photos" button and a "Copy email address" button for people without a mail app.

### Cart Drawer
Paper panel with a 2px ink left edge, a Title heading, line items with 64px square thumbnails, and a footer that totals with tabular figures. Free shipping is written out in bold, not shown as $0. Line names link back to the product. Each portrait is its own line, numbered "House 1, House 2" when there's more than one; replacing a one-of-a-kind's choice says so in the drawer. Removing a line shows an "Undo" notice at the top. Tab stays inside the drawer, and closing it returns focus to what opened it.

### Wordmark and Intro
The "e." mark is Agbalumo with the e rotated -9deg and the dot raised 0.12em. It is sized so the e fills about 80% of the header button height and is centred in the bar. On the front page an intro animation lands the mark in that exact spot once per visit, then the page fades in section by section (90ms apart). Reduced motion skips the intro and all transitions. The same mark has a hover/tap spin (the e winds back, whips around three times and springs home), and it plays once on its own on the thank-you page after a real order: the shop's one celebration, used only where it's earned.

## Do's and Don'ts

### Do:
- **Do** take every color from the tokens, and define any new token for both modes.
- **Do** outline interactive elements in 2px ink with a 4px radius.
- **Do** keep Agbalumo for headings and the wordmark, and Instrument Sans for everything else.
- **Do** use tabular figures for prices, counts and quantities.
- **Do** keep product photos on the tint mat: square in grids and cart, uncropped on product pages.
- **Do** use the shared easing (`cubic-bezier(.2,.7,.2,1)`) and the hover-strip pattern for anything that lifts.
- **Do** check new layouts at two-column phone width (480px and below) first.
- **Do** respect `prefers-reduced-motion`: no transitions, no intro.
- **Do** give every focusable control a visible 2px ink focus ring (offset 3px) on keyboard focus, on top of any hover lift, so focus never looks like a mouse hover.
- **Do** keep the Stickers chip on the first phone screen whenever anything is added above it, and keep "ed.mcveigh shop" as the front-page heading.
- **Do** say "Nothing was charged" in any checkout error, and never show raw technical messages.

### Don't:
- **Don't** drift toward slick minimal luxury: no thin or high-contrast serifs, no stark white pages, no black buttons, no fashion-brand restraint.
- **Don't** add a second accent color, gradients or colored panels to the interface. Color belongs to the art.
- **Don't** set body copy, buttons, labels or prices in Agbalumo.
- **Don't** use large radii or pill shapes on controls.
- **Don't** make anything lift or move without hover, keyboard focus or a press.
- **Don't** put small soft-ink text on the tint mat. It measures 4.3:1, below the 4.5:1 minimum for small text. Use full ink there.
- **Don't** hard-code a light-mode hex inside a component, except the white paper of the drawn placeholders.
