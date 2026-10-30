-- Tenant details: an email for each person and a primary contact for each apartment.
alter table person add column email text;
alter table unit add column primary_contact_id uuid references person(id);
