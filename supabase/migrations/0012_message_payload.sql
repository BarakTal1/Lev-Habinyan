-- The structure of each message (buttons, list rows, template parameters), so a chat can be shown again exactly as it was.
alter table message_log add column payload jsonb;
