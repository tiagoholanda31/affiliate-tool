import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Configurações" };

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Regras do programa, contatos e termos aceitos pelos afiliados."
      />
      <SettingsForm initial={settings} />
    </>
  );
}
