alter policy "Users can read their payment orders"
on public.payment_orders
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists payment_orders_product_id_idx
  on public.payment_orders(product_id);
