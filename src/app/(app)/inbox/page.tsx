import { ChatReply } from "@/components/ChatReply";
import { Icon } from "@/components/Icon";
import { LtrText } from "@/components/LtrText";
import { Page } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { listAgentChats } from "@/lib/db/inbox";
import { t } from "@/lib/labels";
import { waLink } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

/** Chats where a resident asked for a person. */
export default async function InboxPage() {
  await requireUser();
  const chats = await listAgentChats(await createClient(), new Date());
  return (
    <Page title={t.inbox.title} sub={t.inbox.sub} width="medium">
      {chats.length === 0 ? <p className="card p-6 text-center text-muted">{t.inbox.empty}</p> : (
        <ul className="flex flex-col gap-3">
          {chats.map((c) => (
            <li key={c.phone} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div dir="rtl" className="font-semibold">{c.name ?? t.inbox.unknown}</div>
                  <div className="text-sm text-muted"><LtrText>{`+${c.phone}`}</LtrText></div>
                </div>
                <a href={waLink(c.phone) ?? "#"} aria-label={t.buildings.chat} className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#E3F4EA] text-[#1E6B45]"><Icon name="chat" size={22} /></a>
              </div>
              <p dir="rtl" className="rounded-xl bg-[#F4F6FA] p-3">{c.lastMessage}</p>
              <ChatReply phone={c.phone} insideWindow={c.insideWindow} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
