# UI/UX brief: Waste2Light components platform

Design brief for Claude Design. It covers the brand, the voice, every page with its content, the shared components and states, and what the HTML export must look like so it can be built into the app (Next.js).

Working name: **Waste2Light Store**. The final name and domain are not chosen yet, so keep the name in one place (the header logo lockup and the footer) where it is easy to swap.

---

## 1. What this platform is

Waste2Light Ltd (Bosso, Minna, Niger State) builds practical pathways into renewable energy, technology and innovation: rechargeable lanterns made from discarded plastic bottles, Green Energy Corners in schools, STEM kits, and a locally built wind turbine. This platform is **Waste2Light's components and kits branch**: the place where students, schools, makers and engineers buy the electronics and energy parts they need, or a complete kit for a project, delivered in Minna.

Three things people do here:

1. **Buy components**: browse about 1,300 electronics and energy components (Arduino boards, sensors, solar cells, motors, batteries, tools), add to cart, pay online with Paystack, get them delivered or pick them up in Minna.
2. **Build a project**: open a ready-made project (for example a solar phone charger), see what it is, what you learn and the step-by-step guide, then buy the whole kit in one click or ask for a quote for a class.
3. **Request a quote**: schools and organisations send a cart or project as a quote request; Waste2Light calls them and sends an official quotation.

The same site has an **admin area** for the Waste2Light team (orders, quote requests, products, projects, customers, settings).

## 2. Audiences

| Who | What they need | Device |
| --- | --- | --- |
| University and polytechnic students (e.g. FUTMINNA) | Find a part fast, see the price and whether it's in stock, pay cheaply | Mostly phones, often on slow data |
| Secondary-school teachers and school administrators | Ready project kits for a class, a formal quotation to get approval | Phone and laptop |
| Hobbyists and makers | Search by part name, compare, buy a few items | Phone |
| Organisations, NGOs, partners | Bulk quotes, invoices, a trustworthy supplier | Laptop |
| Waste2Light staff (admin) | See what needs doing today, process orders and quotes quickly | Laptop, sometimes phone |

Design implications: mobile first, light pages (few large images, no autoplay video), prices and stock state always visible, the cart and WhatsApp always one tap away.

## 3. Brand

Keep the Waste2Light brand exactly; the layout and components are new.

### Colours (from waste2light.com)

| Token | Hex | Use |
| --- | --- | --- |
| `--color-bg` | `#f7f8f3` | Page background (warm off-white) |
| `--color-surface` | `#ffffff` | Cards, panels, inputs |
| `--color-text` | `#17231c` | Main text |
| `--color-muted` | `#66736b` | Secondary text |
| `--color-border` | `#d8dad5` | Borders, dividers |
| `--color-primary` | `#0c5c2e` | Brand green: primary buttons, links, prices |
| `--color-forest` | `#0c4a23` | Dark green: hero and footer backgrounds, hover |
| `--color-leaf` | `#35a65a` | Bright green: accents, "In stock", progress |
| `--color-sun` | `#f6c453` | Yellow: highlights, badges, one key call to action per page at most |
| `--color-primary-soft` | `#e7f4eb` | Pale green: selected states, soft panels |
| `--color-warn` / `--color-warn-bg` | `#8a5a00` / `#fdf0d4` | Warnings (low stock, pending) |
| `--color-danger` / `--color-danger-bg` | `#a02222` / `#fde5e5` | Errors, out of stock, cancelled |

All text must meet WCAG AA contrast (4.5:1 for body text). White on `--color-primary` and on `--color-forest` passes; text on `--color-sun` must be `--color-text`, never white.

### Type

- Headings: **Manrope** (500, 700, 800), tight letter-spacing (-0.02em) on large sizes.
- Body and UI: **Inter** (400, 500, 600). Inter has the naira sign (₦); Manrope does not, so **prices are always set in Inter**.
- Suggested scale: 14 / 16 (body) / 18 / 22 / 28 / 36 / 48 (hero, desktop only; 32 on phones).
- Numbers in tables and prices use tabular figures.

### Shape and feel

- Buttons and navigation pills fully rounded (999px), like the main site. Cards and inputs 8 to 12px radius.
- Flat and clean: thin borders, very light shadows only on hover or on floating things (cart drawer, menus).
- Imagery: real photos of Waste2Light work (lanterns, turbine, students building), product photos on pure white. Simple line icons (one icon set, 1.5px stroke).
- The logo is the existing Waste2Light mark (green). Wordmark "Waste**2**Light" with the "2" in brand green.

### Voice

Plain, practical and encouraging. Short sentences. Speak to builders ("Build a solar phone charger this weekend") and to schools ("Everything your class needs, in one kit"). No jargon in headings. Prices are always shown in naira with the ₦ sign and thousands separators (₦98,120), whole naira, no kobo.

## 4. Site map

**Public**

- `/` Home (landing page)
- `/shop` Shop (all products), with category pages as filters
- `/shop/[product]` Product page
- `/projects` Projects
- `/projects/[project]` Project page
- `/cart` Cart (also a slide-in cart drawer from any page)
- `/checkout` Checkout (one page), then Paystack, then `/checkout/success` or `/checkout/failed`
- `/quote-request` Request a quote (from the cart or a project)
- `/track` Track an order (order number + email, for guests)
- `/account` Sign in / create account; then `/account/orders`, `/account/orders/[id]`, `/account/quotes`, `/account/addresses`, `/account/profile`
- `/about` About (this branch and Waste2Light)
- `/contact` Contact
- `/delivery` Delivery and pickup, `/refunds` Refund policy, `/terms`, `/privacy`
- 404 and error pages

**Admin** (`/admin`, signed-in staff only)

- Dashboard, Orders, Order detail, Quote requests, Quote request detail, Quotations (existing builder and PDF), Products, Product detail, Stock, Projects, Project editor, Customers, Customer detail, Notifications, Sync, Settings, Staff and roles, Activity log.

## 5. Global layout

### Header (public)

- Left: logo lockup (mark + "Waste2Light" + a small "Store" label).
- Centre (desktop): Shop, Projects, For schools (anchors to the quote section on Home), About, Contact.
- Right: search (an icon that opens a full-width search field on phones; an inline field on desktop), account icon, cart icon with item count badge.
- Phone: logo, search icon, cart, menu button. The menu opens a full-height sheet with the nav links, Track order, WhatsApp us, Sign in.
- A thin top strip (dismissible): "Delivery and pickup in Minna, Niger State. Free delivery on every order."

### Footer (public)

- Forest-green background, white text.
- Columns: Shop (categories), Projects, Help (Track order, Delivery and pickup, Refunds, Contact), Waste2Light (About, waste2light.com, Green Energy Corner, Partner with us).
- Contact block: Waste2Light Ltd, Bosso, Minna, Niger State, Nigeria · info@waste2light.com · +234 813 439 2943 · WhatsApp +234 807 878 7646 · TikTok @waste2light · LinkedIn.
- Payment line: "Secure payments by Paystack" with card, bank transfer and USSD marks.
- Bottom row: © Waste2Light Ltd, Terms, Privacy, Cookies.

### Floating WhatsApp button

Bottom right on every public page, green circle with the WhatsApp icon, label "Chat with us" on desktop hover. It must not cover the checkout button or the cart drawer's total on phones (lift it above sticky bars).

### Admin layout

- Left sidebar (collapsible; a bottom tab bar on phones with Dashboard, Orders, Quotes, More): Dashboard, Orders, Quote requests, Quotations, Products, Stock, Projects, Customers, Sync, Settings, Staff, Activity.
- Top bar: global search (orders, customers, products), notification bell with count, the signed-in user with role.
- Denser than the public site: tables, filters, status chips, bulk actions.

## 6. Pages and content

Copy below is a draft taken from waste2light.com; keep its meaning, adjust lengths to fit the design. Text in [brackets] is a placeholder.

### 6.1 Home (landing page)

1. **Hero** (forest-green background or a strong photo of students building with a dark overlay)
   - Eyebrow: "Waste2Light Store · Power. Learn. Build."
   - Headline: "Components and kits for Nigeria's next builders."
   - Sub: "From one sensor to a full classroom of STEM kits: buy the parts you need, or a complete project kit, delivered in Minna."
   - Buttons: "Shop components" (primary) and "Explore projects" (secondary). Below: a search field "Search 1,300+ components, e.g. Arduino, solar panel, servo".
2. **Three ways to get started** (three cards with icons): Buy components ("Add to cart and pay online with card, transfer or USSD."), Build a project ("Pick a project, get every part in one kit."), Request a quote ("For schools and organisations: send us your list, we'll call you.").
3. **Shop by category** (tiles, 8 to 10): Microcontrollers and boards, Sensors, Solar and power, Batteries and chargers, Motors and drivers, Displays and LEDs, Modules and communication, Tools and prototyping, Kits, Wires and connectors. Each tile: icon or photo + name + item count.
4. **Featured projects** (3 or 4 project cards; see 7.3) with "See all projects".
5. **Popular components** (a horizontal row of 8 product cards; a swipeable row on phones).
6. **Who we are**: split section, photo of the Minna wind turbine or the lanterns on one side.
   - Heading: "Lighting tomorrow with today's waste."
   - Text: "Waste2Light started by turning discarded plastic bottles into rechargeable lanterns. Today we build renewable-energy systems, run Green Energy Corners in schools and train young innovators in Minna. This store is our components and kits branch: the same parts we use in our labs, available to every student, school and maker."
   - Link: "Our story" (to /about) and "Visit waste2light.com".
7. **Impact so far** (four numbers in a row): 50 rechargeable study lanterns delivered · 10 STEM Innovation Kits distributed · 800W wind turbine prototype built in Minna · 105cm locally cast fibreglass turbine blade.
8. **For schools** (pale-green panel): "Bring hands-on renewable energy into your classroom." "Choose a project, tell us how many students, and we'll send a formal quotation and set it up with you." Buttons: "Request a quote for your school" and "See the Green Energy Corner" (to waste2light.com/green-energy-corner).
9. **How it works** (4 steps with icons): Choose your parts or a project → Pay online or request a quote → We call to confirm → Delivery or pickup in Minna.
10. **Partners** (logo strip, greyscale, colour on hover): FUTMINNA (Mechatronics & Electronics Engineering), RMRDC Niger State, Niger State Government, LEAP Africa, Superior Minds Academy, Society of Petroleum Engineers Minna Chapter. Logos are placeholders until we supply files.
11. **Final call to action** (sun-yellow band): "Ready to build?" Buttons: "Start shopping" and "Chat on WhatsApp".

### 6.2 Shop

- Title "Shop all components", count "[1,297] products".
- Left filter column on desktop; a "Filters" button opening a bottom sheet on phones: Category (list with counts), Availability (In stock only, on by default), Price range (min and max in ₦), Sort (Relevance, Price low to high, Price high to low, Newest, A to Z).
- Active filters shown as removable chips above the grid.
- Grid of product cards: 2 columns on phones, 3 on tablets, 4 on desktop. 48 per page with numbered pagination (not infinite scroll), and the page number kept in the URL.
- Empty result: "No components match '[search]'." with "Clear filters" and "Can't find it? Ask us on WhatsApp, we may be able to source it."

### 6.3 Product page

- Breadcrumb: Shop › [Category] › [Product].
- Left: large image on white (zoom on click; gallery thumbnails if several).
- Right: title, price (large, Inter, brand green), stock state ("In stock" leaf green / "Out of stock" red), quantity stepper, "Add to cart" (primary, full width on phones), "Buy now" (goes to checkout), "Add to a quote request" (text link).
- Trust row: "Delivery or pickup in Minna", "Secure payment by Paystack", "Questions? WhatsApp us".
- Description (rich text from the product).
- "Used in these projects" (project cards, if any).
- "You may also need" (product cards from the same category).
- Phones: a sticky bottom bar with price and "Add to cart".
- No supplier name, supplier link or product code anywhere.

### 6.4 Projects

- Title "Projects", sub: "Pick a project. We'll send every part you need in one kit."
- Filters as chips: Level (Beginner, Intermediate, Advanced), Age group (Primary, Secondary, University, Adult), Topic (Solar, Wind, Sensors, Robotics, Lighting, Recycling).
- Grid of project cards (see 7.3).

Demo projects to show (content is placeholder; we write the real ones later):

| Project | Level | Age | Kit includes (examples) |
| --- | --- | --- | --- |
| Solar phone charger | Beginner | Secondary | Solar panel, charge controller module, USB boost module, battery holder, wires |
| Bottle lantern (the Waste2Light classic) | Beginner | Primary and secondary | LED strip, Li-ion cell, TP4056 charger module, switch, recycled bottle |
| Smart dustbin | Intermediate | Secondary | Arduino Uno, ultrasonic sensor, servo motor, jumper wires, battery pack |
| Mini wind turbine generator | Intermediate | Secondary and university | DC motor as generator, blades, rectifier, LED, multimeter |
| Weather station | Intermediate | University | Arduino, DHT22, BMP280, LCD display, breadboard |
| Line-following robot | Advanced | University | Arduino, motor driver, 2 gear motors, IR sensors, chassis, battery |

### 6.5 Project page

1. Hero: project photo or video, title, one-line summary, chips (level, age group, time to build e.g. "2 hours"), and a price box: "Complete kit ₦[45,600]" + quantity of kits + "Buy the kit" (primary) + "Request a quote for a class" (secondary).
2. "What you'll build" (description, 2 or 3 short paragraphs).
3. "What you'll learn" (4 to 6 bullet outcomes with check icons).
4. "What's in the kit" (table: image, component name linked to its product, quantity, unit price, line total; kit total at the bottom; any item out of stock flagged; "Add selected items only" option with checkboxes).
5. "Step-by-step guide" (numbered steps, each with a photo or diagram and short text; collapsible on phones).
6. "Safety notes" (a small warning panel).
7. "Downloads" (code, wiring diagram, worksheet; links).
8. Related projects.
- Phones: sticky bottom bar with kit price and "Buy the kit".

### 6.6 Cart (page and drawer)

- Drawer from the right on desktop, full-height sheet on phones; opens when something is added, with "Added to cart" confirmation.
- Lines: thumbnail, name, unit price, quantity stepper, line total, remove. Kits appear as one group with the project name and the components listed under it.
- Summary: Subtotal, Delivery "Free (Minna)", Total.
- Buttons: "Checkout" (primary), "Request a quote instead" (secondary), "Continue shopping".
- Note: "Prices can change with supplier prices until you pay. Your price is locked when you check out."
- Empty cart: illustration, "Your cart is empty", "Shop components" and "Explore projects".

### 6.7 Checkout (one page)

- Steps shown at the top: Details › Delivery › Payment.
- Contact: full name, phone (Nigerian format, +234), email; "Create an account with these details" checkbox (then a password field appears); "Already have an account? Sign in".
- Delivery: radio cards "Delivery in Minna (free)" with address fields (street, area in Minna, landmark, notes) and "Pickup at Waste2Light, Bosso, Minna". Note: "We deliver in Minna, Niger State only for now. For large orders we'll agree delivery or pickup with you when we call."
- Order summary on the right (collapsible "Show order summary" at the top on phones).
- "Pay ₦[total] with Paystack" (primary, full width) and "Card, bank transfer or USSD. You'll be taken to Paystack's secure page."
- Agree to Terms and Refund policy (checkbox).
- States: validation errors inline, under each field; submitting; Paystack failed or cancelled page ("Payment not completed. Your cart is saved." with "Try again" and "Request a quote instead").
- Success page: big check, "Thank you, [name]! Order [W2L-ORD-1042] is paid.", "We'll call you on [phone] within [1 working day] to confirm delivery or pickup.", order summary, "Track your order", "Download receipt (PDF)".

### 6.8 Request a quote

- Reached from the cart or a project page ("Request a quote for a class"). The items come in pre-filled and can be edited (quantities, remove, add a note per line).
- Fields: organisation or school name, contact person, role (optional), phone, email, number of students or kits (for projects), needed by (date, optional), delivery or pickup, message.
- Buttons: "Send quote request" (primary), "Download draft PDF" (secondary). The draft PDF is clearly marked "DRAFT, not an official quotation".
- Success: "Request sent. We'll call you within [1 working day] with an official quotation." Reference number [W2L-REQ-0031]. If signed in, it appears in Account › Quotes.
- Later the customer receives the official quotation by email with "View and pay online".

### 6.9 Track order (guests)

- Order number + email → status timeline: Paid › Confirmed › Sourcing › Ready › Out for delivery / Ready for pickup › Completed (and Cancelled / Refunded variants). Each step with date and time. Contact buttons (call, WhatsApp).

### 6.10 Account

- Sign in / Create account (email + password; "Forgot password"). Tabs or side menu: Orders, Quotes, Addresses, Profile, Sign out.
- Orders: list (number, date, items count, total, status chip), detail with timeline, items, receipt PDF.
- Quotes: requests and official quotations (status: Sent, Contacted, Quoted, Accepted, Expired), "View PDF", "Accept and pay".

### 6.11 About

- "Waste2Light Store is the components and kits branch of Waste2Light Ltd." Story (bottles to lanterns, to Green Energy Corners, to a locally built 800W turbine), mission ("Building a cleaner future through renewable energy and innovation"), focus areas (renewable energy, circular economy, STEM education, local manufacturing), impact numbers, partners, link to the full team on waste2light.com/about.

### 6.12 Contact

- Address, phones, WhatsApp, email, opening hours [placeholder], a small map of Bosso, Minna, and a simple contact form (name, email or phone, message).

### 6.13 Delivery, Refunds, Terms, Privacy

- Simple long-text pages with a readable 70-character column, headings and a table of contents on desktop.

### 6.14 Admin pages

- **Dashboard**: cards for Sales today / this month (₦), New orders (to confirm), Open quote requests, Items to source from Microscale, Low stock, Last sync (time, status, held price changes). Below: "Needs attention" list (oldest first) and a sales chart (last 30 days).
- **Orders**: table (number, date, customer, phone, items, total, payment, status, delivery/pickup), filters by status and date, search. **Order detail**: status stepper with "Move to next status", customer and contact buttons (call, WhatsApp, email), lines with **our price, Microscale price, markup and margin**, each line's source (our stock / Microscale) and "Mark unavailable → refund item", payment record (Paystack reference), notes, history.
- **Quote requests**: table (reference, date, organisation, contact, items, estimated total, status: New, Contacted, Quoted, Accepted, Closed). **Detail**: request content, "Call", "WhatsApp", "Create quotation" (opens the existing quote builder pre-filled), notes and history.
- **Quotations**: existing builder (Bill To, Attn, Valid Until, notes, lines, custom lines) and PDF preview, plus "Email to customer".
- **Products**: table with image, name, category, **Microscale price**, markup %, **our price**, stock at Microscale, our stock, visible on shop (toggle). Product detail: edit markup, hide/show, our stock quantity, linked projects, price history.
- **Projects**: list and **Project editor** (title, slug, summary, photos/video, level, age group, time, description, what you'll learn, steps with images, safety notes, downloads, component list with quantities via product search, published toggle, live kit price).
- **Customers**: list and detail (contact info, orders, quotes, total spent).
- **Sync**: last runs, held price changes (approve / reject), "Sync now".
- **Settings**: store name, contact details, notification email(s) and WhatsApp number, delivery note text, default markup, sync times.
- **Staff**: invite by email, role (Owner, Staff), deactivate.
- **Activity log**: who did what, when.

## 7. Components (design each with its states)

1. **Buttons**: primary (green), secondary (outline), tertiary (text), danger, WhatsApp (green with icon); sizes small/medium/large; states default, hover, focus (2px visible ring), pressed, disabled, loading (spinner, label kept).
2. **Product card**: square image on white, title (max 3 lines), price, stock badge, "Add to cart" button with an inline quantity stepper after the first add ("1 in cart − +"). States: in stock, out of stock (button disabled, "Out of stock"), on a project (small "In a kit" tag optional), loading skeleton.
3. **Project card**: photo 4:3, level and age chips, title, one-line summary, "Kit from ₦[x]", "[n] components".
4. **Category tile**.
5. **Price display**: ₦ + whole naira; large/medium/small; struck-through old price not needed.
6. **Stock badge**: In stock (leaf), Low stock (warn), Out of stock (danger). Always a word, never colour only.
7. **Quantity stepper**: − [number] +, typing allowed, min 1.
8. **Search field** with suggestions dropdown (products and projects, with thumbnails).
9. **Filters**: checkbox list, price range, chips, bottom sheet on phones.
10. **Cart drawer** and **cart line** (including a kit group).
11. **Forms**: text, phone (+234 prefix), email, textarea, select, date, radio cards, checkbox; label above field, help text, inline error in red under the field with an icon.
12. **Status chip** for orders and quotes (each status its own colour, always with text).
13. **Timeline / stepper** for order tracking.
14. **Toast** notifications ("Added to cart", "Saved") and **alert banners** (info, success, warning, error).
15. **Modal / dialog** and **bottom sheet** (phones).
16. **Tables** (admin): sticky header, sortable columns, row hover, row actions menu, bulk select, pagination, empty state; on phones, tables become stacked cards.
17. **Stat card** (admin dashboard) and a simple line/bar chart.
18. **Notification bell** with dropdown list (new order, new quote request, sync problem), unread dot.
19. **Empty states** with a short line and one action, and **skeleton loaders** for grids and tables.
20. **Pagination**.
21. **Breadcrumbs**.
22. **Image placeholder** for products with no photo (light grey with the Waste2Light mark).

## 8. Key states to show in the mockups

- Home on phone and desktop.
- Shop with filters applied; shop with no results.
- Product page in stock and out of stock.
- Project page, including the kit table with one out-of-stock item.
- Cart drawer with items and a kit; empty cart.
- Checkout with an error on the phone field; payment failed page; success page.
- Quote request form and its success page.
- Order tracking timeline.
- Admin dashboard, orders list, order detail (showing Microscale price vs our price), quote request detail, product list, project editor.

## 9. Responsive rules

- Breakpoints: 360 (small phone, design for this first), 768 (tablet), 1024 (laptop), 1280 (desktop, max content width 1200px).
- 16px side gutters on phones; no horizontal page scroll anywhere.
- Touch targets at least 44 × 44px.
- Sticky bottom action bars on product, project and checkout pages on phones.

## 10. Accessibility

- WCAG 2.2 AA: contrast, visible focus, labels on every input, errors announced and described in text, alt text on images, headings in order, skip-to-content link.
- Colour never the only signal (stock and status always have words).
- Respect reduced motion: no essential animation; keep transitions under 200ms.

## 11. Performance and data use

- Product images are small thumbnails in grids (about 300px) and larger only on the product page.
- Hero image under 200KB, modern formats; no autoplay video, no heavy animation libraries.
- System fallback fonts while web fonts load.

## 12. What the export must look like

So the HTML can be built into the Next.js app quickly:

- One HTML file per page/state listed in sections 6 and 8 (or one file with clearly separated sections), named by page, e.g. `home.html`, `shop.html`, `product.html`, `project.html`, `cart.html`, `checkout.html`, `quote-request.html`, `track.html`, `account-orders.html`, `about.html`, `contact.html`, `admin-dashboard.html`, `admin-orders.html`, `admin-order-detail.html`, `admin-quote-request.html`, `admin-products.html`, `admin-project-editor.html`.
- Plain HTML and CSS (no JavaScript framework). Small vanilla JS only for showing interactions (drawer, menu, tabs) is fine.
- All colours, fonts, radii and spacing as **CSS custom properties** on `:root`, using the token names in section 3 (add new tokens with the same naming style).
- One shared stylesheet, with readable, component-based class names (e.g. `.product-card`, `.product-card__price`, `.btn--primary`). No utility-class soup and no inline styles.
- Semantic HTML (`header`, `nav`, `main`, `section`, `footer`, `button`, `label`), so the structure carries over.
- Realistic content: real Nigerian names, Minna addresses, naira prices (₦1,500 to ₦250,000), the product types listed in 6.1, not lorem ipsum.
- Images: use placeholders with the intended size and aspect ratio noted; icons as inline SVG from one set.

## 13. Do not show on any public page

- The words "Microscale", "supplier", "markup" or "+10%", or any supplier link or product code. These appear only in admin screens.
- Internal quotation pricing details (unit cost, margin).
