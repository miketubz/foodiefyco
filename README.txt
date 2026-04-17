Orders archive update:
- Admin Orders table now supports:
  - per-row Archive button
  - Archive Selected
  - Archive Completed
  - Archive Cancelled
  - Archive by date range
- Archived orders are excluded from the active Admin Orders list by default.
- New Admin Archive page: /admin/archive
  - filter by date and status
  - unarchive single or selected
  - export selected to PDF
  - print support
- Added admin shortcuts:
  - Front Store
  - Profit Calculator
- Payment proof / QR rendering updated in admin tables.

Supabase migration required:
- Run: supabase/migrations/20260417_add_order_archive_columns.sql
- Added columns are backward-compatible nullable/optional fields:
  - is_archived boolean default false
  - archived_at timestamptz null
  - archived_by text null
  - archive_reason text null
