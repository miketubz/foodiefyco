alter table public.orders
  add column if not exists is_archived boolean default false,
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by text null,
  add column if not exists archive_reason text null;

update public.orders
set is_archived = false
where is_archived is null;

create index if not exists idx_orders_is_archived_created_at
  on public.orders (is_archived, created_at desc);

create index if not exists idx_orders_archived_at
  on public.orders (archived_at desc);
