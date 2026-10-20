# לב הבניין: Track A back-office app

Hebrew, right-to-left, phone-first web app for the two founders. Next.js 16, Supabase, Vercel.
Design: `../docs/superpowers/specs/2026-10-20-track-a-design.md`. Plan: `../docs/superpowers/plans/2026-10-20-track-a.md`.

## Run locally

```bash
npm install
npx supabase start -x studio,imgproxy,vector,edge-runtime,realtime,supavisor,logflare
cp .env.example .env.local        # fill NEXT_PUBLIC_SUPABASE_ANON_KEY from `npx supabase status`
npm run dev
```

Local sign-in: the password form at `/sign-in` (user `dev@lev.local`, password in `supabase/seed.sql`). It exists only when `NEXT_PUBLIC_DEV_LOGIN=1` and the app does not run on Vercel.

## Test

```bash
npm test                 # unit and database tests (needs the local Supabase)
npx supabase test db     # row-level security tests
npx playwright test      # phone and desktop smoke tests (uses the installed Chrome)
npm run typecheck
```

## Deploy checklist (hosted Supabase and Vercel)

1. Create the Supabase project in an account the client owns. Use a paid plan (daily backups) before any real resident data goes in.
2. Apply the migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`. Do not run `seed.sql` on a hosted project.
3. **Auth settings (important).** In the Supabase dashboard, Authentication:
   - Turn **off** the Email provider, or turn off email sign-ups. Access control trusts the email claim in the token, so open email sign-up would let anyone claim a founder's email.
   - Turn **on** the Google provider (client id and secret from Google Cloud).
   - Add the site URL and redirect URLs: `https://<production-domain>/auth/callback` and the preview domain.
4. Add the founders to the allowlist (replace the emails). Run in the SQL editor:
   ```sql
   insert into person (name, role) values ('רועי במבג׳י', 'founder') returning id;   -- note the id
   insert into profile (email, person_id) values ('<roi email>', '<id>');
   -- repeat for עומר שטיגליץ
   ```
5. Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Do **not** set `NEXT_PUBLIC_DEV_LOGIN`.
6. Email reminders: set `RESEND_API_KEY` and `EMAIL_FROM`, then switch on "תזכורות במייל" in the app settings. The job runs daily (`vercel.json`).
7. Open the site on a phone, sign in with Google, and add it to the home screen.
