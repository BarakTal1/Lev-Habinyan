import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Demo only: signs in the shared demo user, so viewers need no Google account. It does nothing unless DEMO_EMAIL and DEMO_PASSWORD are set. */
export async function GET(request: Request) {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return new NextResponse("not found", { status: 404 });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return new NextResponse("demo sign-in failed", { status: 500 });
  return NextResponse.redirect(new URL("/", request.url));
}
