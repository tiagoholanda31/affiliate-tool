import { LABELS } from "@/lib/i18n/pt-BR";
import { formatPhone, type AffiliateProfile } from "@/features/affiliates/queries";

/**
 * Os dados que o afiliado enviou no cadastro, para ele conferir enquanto espera
 * a análise ou antes de reenviar.
 *
 * A chave Pix aparece **mascarada** — é o que está no banco em texto legível
 * (`pixKeyMasked`); a versão completa é decifrada só na tela de pagamento do
 * admin, com registro em auditoria (docs/spec/04, Dados sensíveis).
 */
export function AffiliateSummary({ affiliate }: { affiliate: AffiliateProfile }) {
  const rows: { label: string; value: string }[] = [
    { label: "Nome", value: affiliate.user.name },
    { label: "E-mail", value: affiliate.user.email },
    { label: "Celular", value: formatPhone(affiliate.phone) },
    {
      label: "Rede social",
      value: `${LABELS.socialNetwork[affiliate.socialNetwork] ?? affiliate.socialNetwork} · @${affiliate.socialHandle}`,
    },
    {
      label: "Chave Pix",
      value: `${LABELS.pixKeyType[affiliate.pixKeyType] ?? affiliate.pixKeyType} · ${affiliate.pixKeyMasked}`,
    },
  ];

  return (
    <dl className="divide-y divide-mist-300 rounded-lg border border-mist-300 bg-white">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
          <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{row.label}</dt>
          <dd className="text-sm break-words text-navy-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
