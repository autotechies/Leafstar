# LEAF STAR — Design System and Screen Specs (v1)

This file is the single source of truth for how Leaf Star looks and behaves visually. Every page, in the storefront and the admin, is built from the scales, tokens and components below. **Nothing is styled by eye.** If something is needed that is not here, add it here first, then build it.

The design preview artifact is a rough sketch of direction. Where it differs from this file (it uses pill-shaped buttons and a few off-scale radii), this file wins.

---

## 1. Principles
1. **Photography leads.** Product and factory photos are the hero; the interface stays quiet around them.
2. **One system, two themes.** Navy & Cream (light) and Black & Gold (dark) share identical layouts. Only token values change.
3. **Gold means action.** Gold is used for primary buttons, active navigation, key numbers and SKU codes. Never as decoration (no gold borders, icons, badges or gradients for style).
4. **Wholesale buyers, mostly on phones.** Fast, scannable, large touch targets, no clutter.
5. **Honest content.** No fake photos, numbers or claims. Missing content is a labelled placeholder.
6. **Same thing, same look.** The same job always uses the same component, spacing and wording.

## 2. Colour tokens
Components use these names only (CSS variables switched by `data-theme`). Never raw hex in components.

| Token | Navy & Cream (light) | Black & Gold (dark) | Use |
|---|---|---|---|
| `bg` | `#F9F5ED` | `#0B0B0D` | page background |
| `surface` | `#FFFFFF` | `#161618` | cards, modals, tables, inputs |
| `surface-2` | `#F1EBDD` | `#1F1F22` | hovered rows, chips, image wells |
| `border` | `#E8E1D5` | `#2C2C30` | dividers, card outlines |
| `border-strong` | `#8A8275` | `#6B6B72` | input and control borders (needs 3:1) |
| `text` | `#0F1924` | `#F5F1E8` | body and headings |
| `text-muted` | `#5C6370` | `#A8A399` | secondary text |
| `chrome` | `#1C2B4A` | `#0B0B0D` | navbar, hero, admin sidebar |
| `chrome-text` | `#F9F5ED` | `#F5F1E8` | text on chrome |
| `chrome-line` | `rgba(249,245,237,.28)` | `#2C2C30` | dividers on chrome |
| `gold` | `#C6933A` | `#D4AF5A` | primary buttons, active states |
| `gold-hover` | `#D4A855` | `#E0BC6C` | button hover |
| `on-gold` | `#1C2B4A` | `#0B0B0D` | text on gold |
| `gold-text` | `#7A5C1F` | `#D4AF5A` | SKU codes and gold text on bg/surface |
| `gold-on-chrome` | `#D4A855` | `#D4AF5A` | gold text on chrome |
| `success` | `#166534` | `#4ADE80` | text/icons for good status |
| `warning` | `#A04A06` | `#FBBF24` | low stock, caution |
| `danger` | `#C21F1F` | `#F87171` | errors, out of stock |
| `success-bg` / `warning-bg` / `danger-bg` | `#DCFCE7` / `#FEF3C7` / `#FEE2E2` | `#16301F` / `#33290E` / `#3A1A1A` | status chip fills |
| `ring` | `#1C2B4A` | `#D4AF5A` | keyboard focus ring |
| `overlay` | `rgba(15,25,36,.55)` | `rgba(0,0,0,.70)` | modal backdrop |
| `whatsapp` | `#25D366` | `#25D366` | WhatsApp button only; text on it `#0B0B0D` |
| `series-1` / `series-2` | `#1C2B4A` / `#C6933A` | `#F5F1E8` / `#D4AF5A` | chart lines and bars |

**Contrast, verified** (WCAG 2.1; text needs 4.5:1, icons and control borders 3:1). Light: `text` 16.3 on bg, 14.9 on surface-2; `text-muted` 5.6 bg, 6.0 surface, 5.1 surface-2; `gold-text` 5.7 / 6.2 / 5.2; `success` 6.6 / 7.1 / 6.0; `warning` 5.6 / 6.0 / 5.1; `danger` 5.5 / 6.0 / 5.0; `on-gold` on `gold` 5.1 and on `gold-hover` 6.4; `border-strong` 3.5 on bg, 3.8 on surface; chip text on its fill 4.9 to 6.5. Dark: all text tokens 6.5 or higher on bg, surface and surface-2; `border-strong` 3.4 on surface. **White text on the light gold is 2.75 and is never used.** Light `gold` as text on cream is 2.5 and is never used; use `gold-text`.

Notes:
- Dark theme: `chrome` and `bg` are the same black, so separate them with `chrome-line`/`border`, never by shade alone.
- Never rely on colour alone: stock status always has a text label or icon too.
- Product colour swatches show the real garment hex with a 1px `border-strong` ring so white and cream swatches stay visible.

## 3. Typography
Fonts: **Playfair Display** (600) for headings and key numbers; **Manrope** (400, 500, 600, 700) for everything else. Load through `next/font`.

| Style | Desktop (size / line) | Phone (size / line) | Font | Use |
|---|---|---|---|---|
| display | 56 / 60 | 38 / 44 | Playfair 600 | Home hero headline only |
| h1 | 40 / 48 | 32 / 40 | Playfair 600 | page titles |
| h2 | 32 / 40 | 26 / 34 | Playfair 600 | section titles |
| h3 | 24 / 32 | 22 / 30 | Playfair 600 | card and panel titles |
| h4 | 20 / 28 | 18 / 26 | Manrope 700 | sub-headings, table titles |
| body-lg | 18 / 28 | 17 / 26 | Manrope 400 | hero and intro paragraphs |
| body | 16 / 24 | 16 / 24 | Manrope 400 | default text |
| small | 14 / 20 | 14 / 20 | Manrope 500 | secondary text, table cells |
| caption | 12 / 16 | 12 / 16 | Manrope 600 | labels, chips, SKU codes (letter-spacing .08em, uppercase for eyebrows) |

Rules: nothing under 12px; body text never under 16px on phones for inputs (stops iOS zoom); max line length 70 characters; headings never centred except the hero on phones; numbers in tables use tabular figures; Indian grouping (1,00,000) and ₹.

## 4. Spacing, grid, radius, shadow, motion
**Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96. Only these. Tailwind spacing is configured to this scale.

**Layout widths and gutters**
| Breakpoint | Width | Page gutter | Columns |
|---|---|---|---|
| phone | 375 and up | 16 | 4 |
| tablet | 768 and up | 24 | 8 |
| laptop | 1024 and up | 32 | 12 |
| desktop | 1440 and up | 40 | 12 |

Storefront content max width **1280**, centred. Admin content fills the space beside the sidebar with a max of 1440. Column gap 16 on phone, 24 above.

**Vertical rhythm (storefront):** section padding 64 on phone, 96 on desktop; title block to content 32; card to card gap 16 phone / 24 desktop; inside cards padding 16 phone / 24 desktop (admin cards 16 / 24).

**Radius:** `sm` 6 (chips, size pills, small tags) · `md` 10 (buttons, inputs, selects) · `lg` 14 (cards, panels, table wrappers) · `xl` 20 (hero media, modals, drawers' top corners on phone) · `full` (swatches, avatars, toggle, badges with counts). Nothing else.

**Elevation:** light theme `shadow-1` = `0 1px 2px rgba(15,25,36,.06), 0 4px 12px rgba(15,25,36,.06)` for cards; `shadow-2` = `0 12px 32px rgba(15,25,36,.14)` for modals, popovers and the floating chat button. Dark theme uses **no shadows**: a 1px `border` outline instead; modals add `overlay` behind.

**Motion:** 150 ms for hover and press, 200 ms ease-out for fades, drawers and tab changes, 250 ms for the image blur-to-sharp fade. Nothing bounces or loops except loading skeletons (shimmer 1.4 s). Respect `prefers-reduced-motion`: no movement, fades only.

**Icons:** Lucide, 20px default (16 inside small controls, 24 for primary nav on phone), stroke 1.75, `currentColor`. Icon-only buttons need a visible tooltip on desktop and an accessible label.

## 5. Components (built once in Step 1, reused everywhere)
Each has default, hover, pressed, focus-visible, disabled, loading and (for fields) error states. Focus ring: 2px `ring` with 2px offset on every interactive element.

- **Button** — variants: `primary` (gold fill, `on-gold` text), `secondary` (transparent, 1.5px `text` border), `ghost` (no border), `danger` (danger fill, white text 5.5 or higher), `whatsapp`. Sizes: `sm` 36px high (admin tables only), `md` 44 (default), `lg` 52 (hero and form submit). Radius `md`. Minimum width 96. Label weight 700, 14 or 16px. Icon left, 8px gap. Loading shows a spinner and keeps the width. One primary button per view area.
- **Input / Textarea / Select** — 44px high, `surface` fill, 1px `border-strong`, radius `md`, 16px text, label above (14px/600), helper text below (14px muted), error text in `danger` with an icon, red border. Required fields marked with an asterisk and `aria-required`. Phone input shows +91 prefix.
- **Checkbox, Radio, Switch** — 24px hit area minimum 44 including label; switch on = `gold` track with `on-gold` knob.
- **Badge / status chip** — height 24, radius `full`, caption text, fill from `*-bg`, text from the status token, always with a leading dot or icon. Kinds: in stock, low stock, out of stock, hidden, live, new, overdue.
- **Card** — `surface`, radius `lg`, padding per section 4, `shadow-1` (light) or 1px `border` (dark). Whole card is not a link unless it is a product card.
- **Tabs** — underline style, 44px high, active tab text `text` with 2px `gold` underline.
- **Table** — wrapper is a Card; header row 44px caption text on `surface-2`; rows 52px (44px dense), 1px `border` dividers, hover `surface-2`; numeric columns right-aligned; sticky header; below 768px every table turns into a stack of cards with the same fields. Sorting arrows and a visible empty state.
- **Modal** — centred, max width 560, radius `xl`, `shadow-2`, focus trapped, Esc closes, scroll locked. On phone it becomes a **bottom sheet** (full width, top corners `xl`, drag handle, max height 90vh).
- **Drawer** — right side, 480px wide (full screen on phone). Used for lead details and filters.
- **Toast** — bottom centre on phone, bottom right on desktop; 4 kinds; auto-dismiss 5s, except the 15-second **Undo toast** which shows a countdown bar and an Undo button.
- **Banner** — full-width strip under the top bar for system messages (AI paused, usage high, offline).
- **EmptyState** — icon, h4 title, one line of help, one primary action. Never blank space.
- **Skeleton** — same shape and size as the content it replaces, so nothing jumps.
- **Swatch** — 28px circle (24 in dense places), 1px `border-strong`, selected = 2px `ring` outline with 3px offset, plus the colour name shown beside or below. 44px touch area via padding.
- **SizeChip** — radius `sm`, min 36 wide, 32 high, 1px `border`; unavailable sizes are not shown publicly; in admin they show with strike-through and 0.
- **StockBar** — 8px high, radius `full`, `surface-2` track; fill `success`/`warning`/`danger` by level; always paired with the number.
- **ProcessedImage** — blur placeholder, fade to sharp (250 ms), reserved 4:5 space, graceful error tile.
- **ImageViewer** — full-screen dark overlay (both themes), counter, close button top-right (48px), thumbnail strip bottom, pinch/double-tap/pan/swipe, back gesture closes.
- **Stepper** — numbered steps 01 to 05 for Add Stock; done steps show a check; current step highlighted with gold number.
- **ThemeToggle** — 44px circular button, sun/moon icon, in navbar and admin top bar.
- **Logo** — light-theme version on light surfaces, dark-theme version on dark surfaces and on `chrome`; minimum height 28px; clear space equal to the hexagon's width on all sides.

## 6. Shared layout rules (apply to every page)
1. Every page has exactly one `h1`. Sections use `h2`; cards use `h3`.
2. Content sits on the 12-column grid; nothing is positioned with ad-hoc margins. Left edges of headings, cards and forms align to the same column line.
3. Sections follow the vertical rhythm in section 4. No two adjacent sections use different paddings.
4. Cards in one row share one height; their buttons align along the bottom edge.
5. Primary action position is fixed: forms put Save/Submit bottom-right on desktop and full-width bottom on phone; modals put the primary action right, secondary left.
6. Money, dates and counts always use the same formats: `₹1,25,000`, `24 Oct 2026`, `12,480 pcs`.
7. Every list or data view has a loading skeleton, an empty state and an error state with a Retry button.
8. Labels are sentence case ("Add stock", not "ADD STOCK"). Only eyebrow captions are uppercase.
9. Wording: plain, short, friendly, English. Buttons start with a verb. Errors say what happened and what to do.

## 7. Public screens
Navbar (all pages): height 72 desktop / 64 phone, `chrome`. Left: logo. Centre (desktop): Home, Catalog, About, Contact. Right: Call button (secondary on chrome), enquiry-list icon with gold count badge, ThemeToggle. Phone: logo, enquiry icon, call icon, menu icon; the menu is a full-height drawer with the links and the theme toggle. Sticky; gains a bottom border when scrolled.

Footer: `chrome` background (in dark mode with a top `chrome-line`). A trust strip across the top (Since {year started}, our own factory, across India, Peenya Bengaluru; only facts the owner confirmed). Below it four columns on desktop, two on a tablet, stacked on a phone: brand, tagline and Instagram/Facebook icons; Explore links; Contact (address, email, phone and WhatsApp when set); "Find us" with a small map. The map box is one link: clicking anywhere on it opens the place in Google Maps; the map inside is a picture only (not focusable). Everything is read from Settings (`public_settings`), so the owner edits it in one place; a detail left empty is not shown. A small line with the business name and year at the bottom; Privacy link in Explore.

**Home** (sections in this order; all use the rhythm in section 4). Photos are real files in `public/site`, made by `scripts/prepare-site-photos.mjs` and listed in `src/modules/site/photos.ts`, where each carries `standIn: true` until it is a photo of Leaf Star itself. The page uses no empty placeholders.
1. *Hero* on `chrome`: eyebrow, display headline ("Made in our factory. Ready for your shelves."), body-lg paragraph, two buttons (Browse the catalog primary lg, Talk to us on-chrome lg), three tick points. Right side (desktop) a 4:5 photo (radius `xl`) with a gold outline offset behind it; below the text on a phone.
2. *Facts card*: overlaps the hero's bottom edge by 48px; Since {year started from Settings}, our own factory, wholesale lots, across India. Only facts the owner confirmed.
3. *What we make*: eyebrow, h2, two photo tiles (Shirts, Pants), each with a navy caption bar and arrow; 4:5 on phone, 4:3 from tablet.
4. *Ready to ship*: h2, one line, a row of product cards (4 on desktop, horizontal snap-scroll on phone), "View the full catalog" button.
5. *Made in our factory* on `chrome`: h2 "We make what we sell", three points (cut, stitched, packed here), "See how we make it" button; beside it a three-photo mosaic (factory floor wide, machinery and cutting square).
6. *How a deal closes*: five numbered step cards, then "Start an enquiry" and "Read more about how we work". The site-wide closing band (TrustBand) follows on every page.


**Catalog** `/catalog`: h1, result count, search field, filter chips row (category, style, fabric, pattern, colour, size, brand) and sort. Desktop: filters in a left column (264px) with the grid at 3 columns (4 at 1440); tablet: filters in a drawer, 3 columns; phone: a sticky Filters button, **2-column grid**. Product card layout (all widths): 4:5 image; below it swatches (up to 8 and "+N"), name (h3), code (caption `gold-text`), chips (fabric, pattern), availability badge, "Min. N pcs", then buttons **Request price** (primary md) and **Inquire with AI** (secondary md); a plus icon button on the image's top right adds to the enquiry list (toggles to a check). On a 2-column phone card the two buttons stack full width. The phone card must be checked on a real 375px screen in Step 6; if cramped, the Inquire button becomes an icon-plus-label row under the primary.

**Article page** `/catalog/[code]`: breadcrumb; desktop two columns (gallery 7/12, details 5/12 sticky); phone gallery first. Gallery: main 4:5 image and a thumbnail strip; swatches change the set instantly; tapping opens the viewer. Details: code, h1 name, brand, chips, spec table (fabric, pattern, style, sizes, MOQ, lot rule), availability badge, buttons Request price / Inquire with AI / Add to enquiry list, then a "You may also like" row. A fixed bottom bar with the two main buttons on phone.

**Enquiry list** `/enquiry`: h1, list of rows (thumbnail, name, code, colour picker, quantity stepper in pieces with MOQ hint and warning, remove), summary card on the right (desktop) or bottom (phone) with the Request price form fields and Send button. Empty state links to the catalog. Success state: confirmation with WhatsApp button.

**Request Price form** (modal on desktop, bottom sheet on phone): fields name*, phone*, business name, city, Instagram handle (optional, "@" prefix), quantity, note; submit "Send request" (primary lg); success state with WhatsApp follow-up button.

**Call sheet**: bottom sheet on phone / modal on desktop: large number (tap to dial), divider "Missed us? We'll call you back", mini form (name, phone, optional Instagram), "Request a callback".

**Chat widget**: floating 56px gold circle bottom-right (above the phone's safe area), with `shadow-2`; opens a panel 380×560 on desktop, full screen on phone. Header (logo mark, "Leaf Star assistant", close), messages (visitor right on `surface-2`, assistant left on `surface`), typing indicator, input with send button, privacy notice and Accept on first open, "Forget me" in the menu. Failure state: the WhatsApp fallback message.

**About**: same rhythm as Home. A `chrome` opening (h1, intro, two buttons, 16:9 factory photo with the gold outline); story (text left, cutting-table photo right); factory, people and machines as alternating photo/text rows on `surface-2`; "What you can count on" three cards; fabric-to-lot process timeline on `surface-2`; "from enquiry to delivery" strip with two buttons. Sections alternate plain and `surface-2` so no two neighbours share a background. There is no video block until the owner has a video.
**Contact**: two columns: details (phone, WhatsApp, email, address, Instagram, map link) and the form; stacked on phone.
**Privacy / 404 / error**: simple text page at reading width 720; 404 has the logo, a friendly line and Catalog and Home buttons.

## 8. Admin screens
**Shell:** sidebar 248px on `chrome` (logo, nav, user at bottom), top bar 64px (page title, global search field, ThemeToggle, user menu) on `bg` with a bottom `border`; content padding 24 phone / 32 desktop. Nav items: Dashboard, Inbox (live count badge), Inventory, Add stock, Scan bills, Bills, CRM, Buyers, Chats, Settings; item height 44, active = `gold-on-chrome` text and a 3px gold left bar. Below 1024px the sidebar becomes a drawer opened by a menu button; the top bar keeps search as an icon that expands. Page header pattern: h1 left, primary action right (secondary actions beside it), optional tabs underneath.

**Login:** centred Card (max 420) on `bg`; logo, h2 "Owner login", email, password (show/hide), Sign in, "Forgot password"; clear errors; no sign-up link.

**Dashboard** (read-only; distinct from Inventory): range selector (7/30/90 days) at the top. Order is the order of importance to the owner: (1) "Needs attention" row of four cards (buyers waiting, out of stock, running low, follow-ups due), each a link to the page that fixes it; (2) four key numbers (pieces in stock, sold, made, open leads); (3) "Stock in and out" chart beside "Restock first"; (4) "Demand vs stock" beside "Stock by article"; (5) a "To tidy up" card that only appears when something needs fixing (bills to review, unreadable bills, articles without photos, published articles hidden for no stock); (6) one collapsed "More insights" section holding size, colour and shirt/pant spread, slow movers, recent movements and AI use. A chart's hidden data table is kept inside the chart (`relative`) so it can never widen the page. Nothing here is computed differently from Inventory, Inbox or CRM, so a number always matches the page it links to.

**Inbox:** header with count and bulk bar (appears when rows are ticked). Tabs: Unanswered, Handled, Anonymous. Rows grouped by contact: avatar initial, name, phone, kind chips, preview, "waiting 3 h" (danger text after 24 h), actions Call / WhatsApp / Mark handled / Open lead / Dismiss. Phone: rows are cards with the actions in a bottom row. After Call or WhatsApp a small prompt "Mark as handled?" appears on the row. A help panel explains what the site can and cannot know about calls.

**Inventory list:** search, filter chips, table/cards toggle. Table columns: thumbnail (opens viewer), code, name, brand, category, style, fabric, total pieces with StockBar, status badges, live/hidden. Phone shows cards. **Detail** `/admin/inventory/[code]`: header (thumbnail, code, name, badges, actions Edit / Publish-Hide / Archive); a **colour × size grid** (rows colours with swatch, columns sizes, cells show pieces with a coloured background by level; clicking a cell opens an adjust dialog: new count or +/- amount, required note, preview of resulting stock); variant SKU with copy button; photos section with viewer; stock history as a timeline grouped by day (Today, Yesterday, then the date, India time): a green up arrow or red down arrow, the signed change, the SKU, the reason and note, the time, and **Undo** on manual rows; an undone entry is greyed with the change struck through.

**Add stock** `/admin/stock/add`: tabs "New article", "Add to existing article", "Import from Excel". New article is the five-step Stepper (01 Basics, 02 Colours, 03 Sizes, 04 Photos, 05 Opening stock), the form on the left and a sticky **live preview card** on the right (below the form on phone), Back/Next at the bottom, draft autosave indicator "Saved just now", unsaved-changes warning. Opening stock is a colour × size grid of number fields. Success: a toast with a 15-second Undo, and links to the new article. Import: template download, upload, preview table with row errors highlighted, then Import.

**Scan bills:** step 1 drop zone (large dashed area, camera button on phone, accepted formats listed, rejected formats explained); step 2 queue list with per-file status chip, progress bar, Retry; step 3 review: left the original bill in the viewer, right the editable lines table with confidence badges and current → resulting stock; unmatched rows in `warning-bg`; footer bar with "Apply and deduct stock" (primary lg) that becomes the 15-second Undo toast. Phone: stacked, bill above lines with a toggle. **Bills history:** table (number, date, buyer, lines, pieces, status badge, applied by) with a detail drawer and a clearly confirmed Undo.

**CRM:** board with six columns (New, Contacted, Quoted, Negotiation, Won, Lost), each column header with count; lead cards (name, phone, article thumbnails, source chip, follow-up date, overdue in `danger`); drag-and-drop on a computer. From 768px up the six columns are a fixed 288px wide (token `board`) in a row that scrolls sideways, so nothing is squeezed; below 768px a stage selector at the top shows one column at a time. Every card has a stage menu at every width, so a card can be moved without dragging (and by keyboard); dragging across the far columns of a laptop screen is awkward. Dates read `11 Nov 2026`; a long line is cut with an ellipsis, never wrapped over its neighbour. **Lead drawer:** contact block with call/WhatsApp buttons and Instagram, articles asked about, timeline, note box, follow-up date, quoted amount, lost reason (required when moving to Lost). **Buyers:** table with totals and last purchase; detail drawer with bill history.

**Chats:** list of sessions (visitor, article, last message, flag), transcript pane, "flag as bad", notes; an "Unanswered questions" tab where the owner turns a question into an FAQ entry.
**Settings:** sections as Cards: Business details, Brands (name, show-on-website switch), FAQ and policies, Alerts (alert email, phone notifications install help), AI usage (today's tokens vs budget, budget field, pause switch), Account (change password, two-step login help).

## 9. Accessibility
Keyboard reachable everywhere with visible focus; dialogs trap and restore focus; `aria-live` for toasts and the chat; all images have meaningful alt text (product name + colour); inputs have labels; touch targets at least 44×44; no information by colour alone; zoom to 200% without loss; honour reduced motion; language attribute set; forms announce errors.

## 10. Consistency checklist (run on every page of every step)
- [ ] Only token colours, scale spacing, scale radii, type styles from this file (search the diff for raw hex and arbitrary pixel values).
- [ ] One `h1`; headings in order; left edges aligned to the grid.
- [ ] Section spacing matches section 4; card heights equal in a row; buttons aligned.
- [ ] Every interactive element shows hover, focus, pressed, disabled and loading states.
- [ ] Loading, empty and error states present.
- [ ] Text contrast passes in both themes (automated check plus a look at the screenshots).
- [ ] Screenshots at 375, 768, 1024 and 1440 in **both themes** reviewed, with no horizontal scroll, clipped text or overlapping elements.
- [ ] Copy follows section 6 (sentence case, verbs, formats).
- [ ] Photo smoothness checked by the owner on a real phone.

Automated: Playwright captures every page at the four widths in both themes on each step; an accessibility scan (axe) runs on each page; the diff is checked for raw colours and off-scale values.
