-- The public platform: storefront products, customer and staff accounts, carts, orders and payments,
-- quote requests, projects, our own stock, notifications and the activity log.

-- Storefront products ------------------------------------------------------------------------------
-- A stable public id (the URL never shows the supplier's handle or SKU), the description and every image.
alter table supplier_products
  add column id          bigserial,
  add column description text not null default '',
  add column images      jsonb not null default '[]'::jsonb;
create unique index supplier_products_id on supplier_products (id);
create index supplier_products_title_trgm on supplier_products (lower(title));

-- Admin choices per product. Kept apart from supplier_products, which each sync rewrites.
create table product_settings (
  supplier    text not null check (supplier in ('microscale', 'hub360')),
  ref         text not null,
  hidden      boolean not null default false,
  markup_pct  numeric(6,2) check (markup_pct is null or markup_pct >= 0),
  featured    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (supplier, ref)
);

-- What Waste2Light holds itself. Stock above zero makes a product buyable even when the supplier is out.
create table stock (
  supplier    text not null check (supplier in ('microscale', 'hub360')),
  ref         text not null,
  quantity    integer not null default 0 check (quantity >= 0),
  updated_at  timestamptz not null default now(),
  primary key (supplier, ref)
);

-- Accounts -----------------------------------------------------------------------------------------
create table users (
  id             serial primary key,
  email          text not null,
  name           text not null default '',
  phone          text not null default '',
  password_hash  text,
  role           text not null default 'customer' check (role in ('customer', 'staff', 'owner')),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);
create unique index users_email on users (lower(email));

create table password_tokens (
  token_hash  text primary key,
  user_id     integer not null references users(id) on delete cascade,
  purpose     text not null check (purpose in ('reset', 'invite')),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table addresses (
  id          serial primary key,
  user_id     integer not null references users(id) on delete cascade,
  label       text not null default '',
  street      text not null,
  area        text not null default '',
  landmark    text not null default '',
  city        text not null default 'Minna',
  state       text not null default 'Niger',
  created_at  timestamptz not null default now()
);

-- Projects (before carts and orders, which point at them) ------------------------------------------
create table media (
  id          bigserial primary key,
  mime        text not null,
  bytes       bytea not null,
  name        text not null default '',
  created_at  timestamptz not null default now()
);

create table projects (
  id           serial primary key,
  slug         text not null unique,
  title        text not null,
  summary      text not null default '',
  description  text not null default '',
  learn        jsonb not null default '[]'::jsonb,   -- ["Read a solar panel's rating", ...]
  level        text not null default 'Beginner' check (level in ('Beginner', 'Intermediate', 'Advanced')),
  age_group    text not null default 'Secondary',
  topics       text[] not null default '{}',
  build_time   text not null default '',
  image_url    text,
  video_url    text,
  steps        jsonb not null default '[]'::jsonb,   -- [{title, text, image}]
  safety       text not null default '',
  downloads    jsonb not null default '[]'::jsonb,   -- [{label, url}]
  published    boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table project_items (
  project_id  integer not null references projects(id) on delete cascade,
  supplier    text not null check (supplier in ('microscale', 'hub360')),
  ref         text not null,
  quantity    integer not null check (quantity > 0),
  position    integer not null default 0,
  primary key (project_id, supplier, ref)
);

-- Carts --------------------------------------------------------------------------------------------
-- One cart per visitor (a cookie holds its id); it follows the customer when they sign in.
create table carts (
  id          uuid primary key,
  user_id     integer references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index carts_user on carts (user_id);

-- A line is one product, or one project kit (all of its components, priced together).
create table cart_lines (
  id          serial primary key,
  cart_id     uuid not null references carts(id) on delete cascade,
  supplier    text check (supplier in ('microscale', 'hub360')),
  ref         text,
  project_id  integer references projects(id) on delete cascade,
  quantity    integer not null check (quantity > 0),
  added_at    timestamptz not null default now(),
  check ((ref is not null and supplier is not null and project_id is null) or (ref is null and supplier is null and project_id is not null))
);
create unique index cart_lines_product on cart_lines (cart_id, supplier, ref) where ref is not null;
create unique index cart_lines_kit on cart_lines (cart_id, project_id) where project_id is not null;

-- Quote requests (customers) and the quotations sent back -----------------------------------------
create table quote_requests (
  id                 serial primary key,
  number             text unique,
  user_id            integer references users(id) on delete set null,
  organisation       text not null,
  contact_name       text not null,
  contact_role       text not null default '',
  phone              text not null,
  email              text not null,
  students           integer,
  needed_by          date,
  fulfilment         text not null default 'delivery' check (fulfilment in ('delivery', 'pickup')),
  message            text not null default '',
  status             text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'accepted', 'closed')),
  estimated_total_ngn numeric(14,2) not null default 0,
  quote_id           integer references quotes(id) on delete set null,
  access_token       text not null,
  admin_notes        text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index quote_requests_status on quote_requests (status, created_at desc);

create table quote_request_lines (
  id            serial primary key,
  request_id    integer not null references quote_requests(id) on delete cascade,
  position      integer not null default 0,
  supplier      text,
  ref           text,
  project_id    integer references projects(id) on delete set null,
  title         text not null,
  quantity      integer not null check (quantity > 0),
  unit_price_ngn numeric(12,2) not null default 0,
  line_total_ngn numeric(14,2) not null default 0,
  note          text not null default ''
);

-- A quotation can be sent to a customer, who can accept and pay it online.
alter table quotes
  add column request_id     integer references quote_requests(id) on delete set null,
  add column customer_email text not null default '',
  add column customer_phone text not null default '',
  add column access_token   text,
  add column sent_at        timestamptz,
  add column accepted_at    timestamptz;
create unique index quotes_access_token on quotes (access_token) where access_token is not null;

-- Orders -------------------------------------------------------------------------------------------
create sequence order_number_seq start 1001;

create table orders (
  id               serial primary key,
  number           text not null unique,
  user_id          integer references users(id) on delete set null,
  email            text not null,
  name             text not null,
  phone            text not null,
  fulfilment       text not null check (fulfilment in ('delivery', 'pickup')),
  address          jsonb,
  notes            text not null default '',
  payment_method   text not null default 'paystack' check (payment_method in ('paystack', 'bank_transfer')),
  status           text not null default 'pending_payment' check (status in (
                     'pending_payment', 'paid', 'confirmed', 'sourcing', 'ready',
                     'out_for_delivery', 'ready_for_pickup', 'completed', 'cancelled', 'refunded')),
  subtotal_ngn     numeric(14,2) not null,
  delivery_ngn     numeric(14,2) not null default 0,
  total_ngn        numeric(14,2) not null,
  refunded_ngn     numeric(14,2) not null default 0,
  paystack_reference text unique,
  quote_id         integer references quotes(id) on delete set null,
  cart_id          uuid,          -- emptied once the payment is confirmed
  access_token     text not null,
  admin_notes      text not null default '',
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_status on orders (status, created_at desc);
create index orders_user on orders (user_id, created_at desc);
create index orders_email on orders (lower(email));

-- Every price is a snapshot taken when the order was placed. Kits are stored as their components,
-- grouped under the kit's name.
create table order_lines (
  id                 serial primary key,
  order_id           integer not null references orders(id) on delete cascade,
  position           integer not null default 0,
  kit_project_id     integer references projects(id) on delete set null,
  kit_label          text,
  kit_quantity       integer,
  supplier           text,
  ref                text,
  title              text not null,
  quantity           integer not null check (quantity > 0),
  supplier_price_ngn numeric(12,2),
  units_per_listing  integer not null default 1,
  markup_pct         numeric(6,2),
  unit_price_ngn     numeric(12,2) not null,
  line_total_ngn     numeric(14,2) not null,
  source             text check (source in ('stock', 'supplier')),
  status             text not null default 'ok' check (status in ('ok', 'unavailable', 'refunded')),
  refunded_ngn       numeric(14,2) not null default 0
);
create index order_lines_order on order_lines (order_id, position);

create table order_events (
  id        bigserial primary key,
  order_id  integer not null references orders(id) on delete cascade,
  at        timestamptz not null default now(),
  actor     text not null default 'system',
  status    text,
  note      text not null default ''
);
create index order_events_order on order_events (order_id, at);

create table payments (
  id           serial primary key,
  order_id     integer not null references orders(id) on delete cascade,
  provider     text not null default 'paystack' check (provider in ('paystack', 'bank_transfer')),
  reference    text not null unique,
  amount_ngn   numeric(14,2) not null,
  status       text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  channel      text,
  paid_at      timestamptz,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table refunds (
  id             serial primary key,
  order_id       integer not null references orders(id) on delete cascade,
  order_line_id  integer references order_lines(id) on delete set null,
  amount_ngn     numeric(14,2) not null check (amount_ngn > 0),
  reason         text not null default '',
  provider_ref   text,
  status         text not null default 'pending' check (status in ('pending', 'processed', 'failed', 'manual')),
  error          text,
  created_by     text not null,
  created_at     timestamptz not null default now()
);

-- Notifications and the activity log --------------------------------------------------------------
-- In-app alerts for the team (shared by every staff account).
create table notifications (
  id          bigserial primary key,
  kind        text not null,
  title       text not null,
  body        text not null default '',
  link        text,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index notifications_unread on notifications (created_at desc) where read_at is null;

-- Every email and WhatsApp message the platform tried to send, and what happened.
create table messages (
  id            bigserial primary key,
  channel       text not null check (channel in ('email', 'whatsapp')),
  recipient     text not null,
  subject       text not null default '',
  status        text not null check (status in ('sent', 'failed', 'skipped')),
  error         text,
  related_type  text,
  related_id    integer,
  created_at    timestamptz not null default now()
);
create index messages_created on messages (created_at desc);

create table audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor        text not null,
  action       text not null,
  target_type  text,
  target_id    text,
  detail       jsonb
);
create index audit_log_at on audit_log (at desc);

-- Request counters for the scraping limits (fixed one-minute windows).
create table rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);

create table blocked_ips (
  ip          text primary key,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

insert into settings (key, value) values
  ('default_markup_pct', '10'),
  ('notify_emails', ''),
  ('notify_whatsapp', ''),
  ('bank_transfer_enabled', 'true'),
  ('callback_promise', '1 working day')
on conflict (key) do nothing;
