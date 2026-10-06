-- Every variant in a supplier's public feed, refreshed by each full sync, so the Shop can list them all.
-- Linking happens only when a product is added to the cart: it becomes a component with a supplier listing.
create table supplier_products (
  supplier   text not null check (supplier in ('microscale', 'hub360')),
  ref        text not null,
  handle     text not null,
  title      text not null,
  category   text not null default 'Other',
  image_url  text,
  price_ngn  numeric(12,2) check (price_ngn is null or price_ngn > 0),
  in_stock   boolean,
  position   integer not null default 0,
  seen_at    timestamptz not null default now(),
  primary key (supplier, ref)
);
create index supplier_products_category on supplier_products (supplier, category);

-- The quote cart: components picked in the Shop, waiting to become a quote. One admin, one cart.
create table cart_items (
  component_id integer primary key references components(id) on delete cascade,
  quantity     integer not null check (quantity > 0),
  added_at     timestamptz not null default now()
);
