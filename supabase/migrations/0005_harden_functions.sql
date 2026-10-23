-- Only signed-in users call the access helpers (the row policies run as the signed-in user). Anonymous callers lose EXECUTE.
revoke execute on function is_allowed(), current_profile_id() from public, anon;
grant execute on function is_allowed(), current_profile_id() to authenticated;
-- Fix the search path of the trigger function.
alter function ticket_first_action() set search_path = public;
