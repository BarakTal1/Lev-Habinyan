-- One log row for each item and day. Two simultaneous mark-dones can no longer write two rows.
delete from maintenance_log a using maintenance_log b
  where a.item_id = b.item_id and a.done_at = b.done_at and a.created_at > b.created_at;
alter table maintenance_log add constraint maintenance_log_item_day_key unique (item_id, done_at);
