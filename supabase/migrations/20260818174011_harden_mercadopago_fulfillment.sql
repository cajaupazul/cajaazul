-- Make payment fulfillment atomic and reject re-use of a provider payment ID.
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
  v_conflicting_order_id uuid;
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
    if v_order.provider_payment_id <> p_provider_payment_id then
      raise exception 'payment_order_already_fulfilled';
    end if;
    return v_order;
  end if;

  if p_provider_payment_id is null or length(trim(p_provider_payment_id)) = 0 then
    raise exception 'provider_payment_id_required';
  end if;

  select id
    into v_conflicting_order_id
    from public.payment_orders
   where provider = p_provider
     and provider_payment_id = p_provider_payment_id
     and id <> v_order.id
   for update;

  if found then
    raise exception 'provider_payment_already_used';
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
  );

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
