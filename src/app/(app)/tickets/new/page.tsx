import { NewTicketForm } from "@/components/NewTicketForm";
import { listAssignees, listBuildings } from "@/lib/db/people";
import { createClient } from "@/lib/supabase/server";

export default async function NewTicketPage() {
  const db = await createClient();
  const [buildings, assignees] = await Promise.all([listBuildings(db), listAssignees(db)]);
  return <main className="mx-auto max-w-xl"><NewTicketForm buildings={buildings} assignees={assignees} /></main>;
}
