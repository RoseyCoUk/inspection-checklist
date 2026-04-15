-- Sample data — adjust for Marcel's resort

with t as (
  insert into room_types (name) values ('Standard'), ('Suite')
  returning id, name
)
insert into checklist_items (room_type_id, label, sort_order)
select id, label, ord from t,
  (values
    ('Bed made properly', 1),
    ('Bathroom clean', 2),
    ('Towels stocked', 3),
    ('Minibar stocked', 4),
    ('Trash emptied', 5),
    ('AC working', 6)
  ) as c(label, ord)
where t.name = 'Standard';

with t as (
  select id from room_types where name = 'Suite'
)
insert into checklist_items (room_type_id, label, sort_order)
select t.id, label, ord from t,
  (values
    ('Bed made properly', 1),
    ('Bathroom clean', 2),
    ('Towels stocked', 3),
    ('Minibar stocked', 4),
    ('Trash emptied', 5),
    ('AC working', 6),
    ('Living room tidy', 7),
    ('Balcony clean', 8)
  ) as c(label, ord);

insert into rooms (number, room_type_id)
select '101', id from room_types where name = 'Standard';
insert into rooms (number, room_type_id)
select '102', id from room_types where name = 'Standard';
insert into rooms (number, room_type_id)
select '201', id from room_types where name = 'Suite';
