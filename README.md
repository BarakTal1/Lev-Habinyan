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

## WhatsApp bot (Track B)

A guided chat with fixed rules. No AI, and no third party reads a resident message. Design: `../docs/superpowers/specs/2026-10-26-track-b-whatsapp-bot-design.md`.

**Try it without WhatsApp.** Run the app locally (`NEXT_PUBLIC_DEV_LOGIN=1`, `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status`, `WHATSAPP_CHANNEL=simulator` in `.env.local`), sign in, and open `/dev/simulator`. It writes to the bot as a resident from a new phone number. Everything the app sends to that number (for example a status message) shows there too. The page is a 404 on Vercel.

**Env vars for the real connection:** `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `SITE_URL`. Do not set `WHATSAPP_CHANNEL` on production. With no WhatsApp credentials on Vercel, every send fails and the history shows "failed", never "sent".

**Webhook.** In the Meta app, set the callback URL to `https://<site>/api/whatsapp/webhook` and the verify token to `WHATSAPP_VERIFY_TOKEN`. Subscribe to `messages`. Every request is checked with the app secret.

**Danger alerts.** A "danger" report alerts the on-call phones (Settings, default: the founders) by WhatsApp (only inside their 24-hour window) and by SMS. No SMS provider is chosen, so SMS is recorded as failed until one is added in `src/lib/bot/sms.ts`. The repeat after 10 minutes needs a cron every 5 minutes, which Vercel Hobby does not allow. On Vercel Pro add `{ "path": "/api/cron/alerts", "schedule": "*/5 * * * *" }` to the crons in `vercel.json`.

**Meta checklist** (this is the slow part, start it first):

1. Meta business account, a new phone number for the pilot (a number on the WhatsApp Business app cannot move to the API without disabling the app), and business verification.
2. Choose the Cloud API directly or a business solution provider, after a price check.
3. Submit the four templates below (language `he`, category utility). Inside the 24-hour window the bot sends plain text, so a template is only needed outside the window.
4. Lawyer: Amendment 13, the privacy text (`src/lib/bot/texts.ts`, version `v1`), and data processors.
5. Settings: working hours, the emergency number, the on-call phones.

**Templates to submit:**

| Name | Text |
|---|---|
| `ticket_assigned` | שלום {{1}}, פנייה {{2}} התקבלה ושויכה לטיפול. נעדכן כשיש מועד. |
| `ticket_visit` | פנייה {{1}}: נציג יגיע ב-{{2}} בין {{3}} ל-{{4}}. |
| `ticket_done` | פנייה {{1}} טופלה. הכול תקין? Buttons: "כן", "לא, לפתוח מחדש" |
| `ticket_info` | לגבי פנייה {{1}}: {{2}} |

## Deploy checklist (hosted Supabase and Vercel)

1. Create the Supabase project in an account the client owns. During development the free plan is fine, with fake data only. The free plan has no daily backups, and it pauses the project after about one week without use. Move to a paid plan before any real resident data goes in.
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
5. Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `SITE_URL` (the public address, for example `https://app.example.com`). Do **not** set `NEXT_PUBLIC_DEV_LOGIN`.
6. Email reminders: set `RESEND_API_KEY` and `EMAIL_FROM`, then switch on "תזכורות במייל" in the app settings. The job runs daily (`vercel.json`).
7. Open the site on a phone, sign in with Google, and add it to the home screen.

## Hosted test deploy (free plan, fake data only)

- Supabase project `lev-habinyan`, ref `dfasbjtcaehdugjzufto`, region eu-central-1. Migrations 0001 to 0005 are applied.
- The hosted database holds the fake sample data from `supabase/seed.sql`, without the local dev user. The dev password sign-in does not exist there.
- The two remaining security advisor notes (`is_allowed`, `current_profile_id` callable by signed-in users) are intended: they return only facts about the caller.
- Do not load real resident data here. Create a paid project and run the migrations again for real data.
