-- Provider-neutral payment orders with idempotent fulfillment.
-- The browser can only read its own orders. Creation and fulfillment are server-only.

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.store_products(id),
  provider text not null check (provider in ('izipay', 'mercadopago')),
  provider_order_id text not null,
  provider_payment_id text,
  status text not null default 'created'
    check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  currency text not null default 'PEN' check (currency = 'PEN'),
  amount_cents integer not null check (amount_cents > 0),
  product_type text not null check (product_type in ('vip', 'coins')),
  product_amount integer not null check (product_amount > 0),
  payment_method text,
  environment text not null check (environment in ('test', 'production')),
  fulfilled_at timestamptz,
  provider_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_order_id)
);

create unique index if not exists payment_orders_provider_payment_uidx
  on public.payment_orders (provider, provider_payment_id)
  where provider_payment_id is not null;

create index if not exists payment_orders_user_created_idx
  on public.payment_orders (user_id, created_at desc);

alter table public.payment_orders enable row level security;

drop policy if exists "Users can read their payment orders" on public.payment_orders;
create policy "Users can read their payment orders"
  on public.payment_orders
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.payment_orders from anon, authenticated;
grant select on table public.payment_orders to authenticated;
grant all on table public.payment_orders to service_role;

create or replace function public.fulfill_payment_order(
  p_provider text,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_currency text,
  p_environment text,
  p_payment_method text default null,
  p_provider_summary jsonb default '{}'::jsonb
)
returns public.payment_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.payment_orders%rowtype;
begin
  select *
    into v_order
    from public.payment_orders
   where provider = p_provider
     and provider_order_id = p_provider_order_id
   for update;

  if not found then
    raise exception 'payment_order_not_found';
  end if;

  if v_order.amount_cents <> p_amount_cents
     or v_order.currency <> p_currency
     or v_order.environment <> p_environment then
    raise exception 'payment_order_mismatch';
  end if;

  if v_order.status = 'paid' and v_order.fulfilled_at is not null then
    return v_order;
  end if;

  if p_provider_payment_id is null or length(trim(p_provider_payment_id)) = 0 then
    raise exception 'provider_payment_id_required';
  end if;

  if v_order.product_type = 'coins' then
    update public.profiles
       set monedas = coalesce(monedas, 0) + v_order.product_amount,
           updated_at = now()
     where id = v_order.user_id;
  elsif v_order.product_type = 'vip' then
    update public.profiles
       set es_vip = true,
           vip_hasta = greatest(coalesce(vip_hasta, now()), now())
                       + make_interval(days => v_order.product_amount),
           subscription_tier = 'premium'::user_plan,
           active_frame_key = 'vip_exclusive',
           updated_at = now()
     where id = v_order.user_id;
  else
    raise exception 'unsupported_product_type';
  end if;

  if not found then
    raise exception 'profile_not_found';
  end if;

  insert into public.transacciones_tienda (
    user_id,
    preference_id,
    payment_id,
    status,
    monto,
    monedas_compradas,
    es_vip_compra,
    product_id,
    payment_method,
    product_type,
    currency
  ) values (
    v_order.user_id,
    v_order.provider_order_id,
    p_provider_payment_id,
    'approved',
    (v_order.amount_cents::numeric / 100),
    case when v_order.product_type = 'coins' then v_order.product_amount else 0 end,
    v_order.product_type = 'vip',
    v_order.product_id,
    p_payment_method,
    v_order.product_type,
    v_order.currency
  ) on conflict (payment_id) do nothing;

  update public.payment_orders
     set provider_payment_id = p_provider_payment_id,
         payment_method = p_payment_method,
         provider_summary = coalesce(p_provider_summary, '{}'::jsonb),
         status = 'paid',
         fulfilled_at = now(),
         updated_at = now()
   where id = v_order.id
   returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.fulfill_payment_order(
  text, text, text, integer, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.fulfill_payment_order(
  text, text, text, integer, text, text, text, jsonb
) to service_role;
