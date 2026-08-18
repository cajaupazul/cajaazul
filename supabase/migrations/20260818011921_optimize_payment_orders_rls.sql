alter policy "Users can read their payment orders"
on public.payment_orders
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((((select auth.jwt()) ->> 'is_anonymous')::boolean), false) = false
);
