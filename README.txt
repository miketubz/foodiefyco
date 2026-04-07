This update adds:
- visible Date Ordered column
- visible Items and Item Count columns
- success message when status changes
- Clear Completed Orders button

Files included:
- src/components/AdminPanel.jsx
- src/hooks/useOrdersExport.js

If status update or clear completed orders fails, you likely need Supabase RLS policies for update/delete.
Example SQL to allow the current browser-based admin setup:

create policy "Allow anon update orders"
on public.orders
for update
to anon
using (true)
with check (true);

create policy "Allow anon delete orders"
on public.orders
for delete
to anon
using (true);

create policy "Allow anon delete order_items"
on public.order_items
for delete
to anon
using (true);
