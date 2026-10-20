import { ImportWizard } from "@/components/ImportWizard";
import { t } from "@/lib/labels";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="px-1 pb-3 pt-2 text-[26px] font-bold">{t.import.title}</h1>
      <ImportWizard />
    </main>
  );
}
