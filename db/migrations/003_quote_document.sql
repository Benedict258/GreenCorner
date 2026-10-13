-- The customer-facing quotation: number, date, validity and attention line on each quote,
-- and on each line the description the customer sees plus whether its unit price was set by hand.
alter table quotes
  add column quote_number text,
  add column quote_date   date,
  add column valid_until  date,
  add column bill_to_attn text not null default '';

-- Quotes made before this get a number from their id, so it can never clash with the W2L-<initials>-<date> form.
update quotes set
  quote_date   = (created_at at time zone 'Africa/Lagos')::date,
  quote_number = 'W2L-Q' || id || '-' || to_char(created_at at time zone 'Africa/Lagos', 'YYYYMMDD');

alter table quotes alter column quote_number set not null, alter column quote_date set not null;
create unique index quotes_quote_number on quotes (quote_number);

alter table quote_lines
  add column description    text,
  add column price_override boolean not null default false;
update quote_lines set description = name;
alter table quote_lines alter column description set not null;
