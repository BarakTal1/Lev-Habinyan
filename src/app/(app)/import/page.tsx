import { ImportWizard } from "@/components/ImportWizard";
import { Page } from "@/components/PageHeader";
import { t } from "@/lib/labels";

export default function ImportPage() {
  return (
    <Page title={t.import.title} width="narrow">
      <ImportWizard />
    </Page>
  );
}
