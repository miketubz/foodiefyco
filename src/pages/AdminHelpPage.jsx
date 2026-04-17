import { Link } from 'react-router-dom';

const sections = [
  {
    title: 'Orders Panel',
    items: [
      'Fetch orders by date range, status, payment status, and source.',
      'View order details, ordered items, proof of payment, and customer information.',
      'Print receipts or save them as PDF from the order actions.',
      'Archive completed or cancelled orders individually or in bulk.',
    ],
  },
  {
    title: 'External Orders',
    items: [
      'Create manual/admin-assisted orders using the same menu and promo logic.',
      'Useful for walk-ins, Facebook orders, or phone orders.',
      'Supports customer details, payment method, promo code, and QR display.',
    ],
  },
  {
    title: 'Promo Codes',
    items: [
      'Create promo codes manually.',
      'Choose fixed discount or percent discount.',
      'Edit, enable/disable, and delete existing promo codes.',
      'Promo codes saved in Supabase can be typed during internal or external ordering.',
    ],
  },
  {
    title: 'Menu Management',
    items: [
      'Add new menu items.',
      'Edit name, price, category, image URL, sort order, and availability.',
      'Use lower sort order values to make items appear earlier in the storefront.',
    ],
  },
  {
    title: 'Gallery & Profit Tools',
    items: [
      'Gallery lets you manage storefront visuals and gallery items.',
      'Profit Calculator helps summarize sales, cost, and profit by date range.',
      'Export reports as CSV, Excel-compatible file, or PDF.',
    ],
  },
  {
    title: 'Best Practices',
    items: [
      'Keep only one active file per route to avoid editing the wrong duplicate.',
      'Use promo start/end dates for limited-time offers.',
      'Archive old completed orders regularly to keep the active list clean.',
      'Test mobile view after changes to admin pages because tables often need mobile cards.',
    ],
  },
];

export default function AdminHelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-500">
              FoodiefyCo Admin
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Help Center
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Quick guide for the main admin tools and how to use them.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Admin
            </Link>
            <Link
              to="/admin/menu"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Menu
            </Link>
            <Link
              to="/admin/profit-calculator"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Profit Calculator
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
              <div className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <div key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">User Management Suggestion</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p className="rounded-xl bg-slate-50 px-4 py-3">
              Best setup: keep admin access invite-only. Do not add a public register page for the admin area.
            </p>
            <p className="rounded-xl bg-slate-50 px-4 py-3">
              Recommended roles: <strong>admin</strong>, <strong>staff</strong>, and optionally <strong>viewer</strong>.
            </p>
            <p className="rounded-xl bg-slate-50 px-4 py-3">
              Store roles in your <code>profiles</code> table and check them before showing sensitive pages or actions.
            </p>
            <p className="rounded-xl bg-slate-50 px-4 py-3">
              For now, you can create users in Supabase Auth and then mark their profile role manually. Later, you can add a dedicated Users page for invite, deactivate, role change, and password reset.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
