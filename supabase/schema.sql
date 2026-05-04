-- Run in Supabase SQL editor

create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null references room_types(id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  category text not null default 'other'
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  room_type_id uuid not null references room_types(id),
  active boolean not null default true
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id),
  worker_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id),
  status text not null check (status in ('good','bad')),
  note text,
  photo_path text
);

create index if not exists reports_created_idx on reports (created_at desc);
create index if not exists report_items_report_idx on report_items (report_id);

-- BUG-03: Unique index prevents duplicate report_items from double-submit races
create unique index if not exists report_items_report_item_uniq
  on report_items (report_id, checklist_item_id);

-- BUG-05: CHECK constraint enforces valid category values across TS, SQL, and UI
alter table checklist_items
  add constraint checklist_items_category_check
  check (category in ('paint','wallpaper','aluminum','hk','mechanical','plumbing','electrical','furniture','cleaning','other'));

-- BUG-12: Composite index for hot-path "latest report per room" query
create index if not exists reports_room_created_idx
  on reports (room_id, created_at desc);

-- Storage bucket: create manually in Supabase dashboard
--   name: checklist-photos
--   public: true
--   then add a policy allowing anon insert
