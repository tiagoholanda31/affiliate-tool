/**
 * Alerta operacional ao admin (docs/spec/07): login de admin, webhook falho,
 * job com erro, divergência de reconciliação. Um template só, com título e
 * pares rótulo/valor, para não multiplicar arquivos por evento.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE } from "./layout";

export type AdminAlertProps = {
  title: string;
  message: string;
  details: { label: string; value: string }[];
  actionUrl?: string;
  actionLabel?: string;
};

export function AdminAlert({ title, message, details, actionUrl, actionLabel }: AdminAlertProps) {
  return (
    <EmailLayout preview={title} heading={title}>
      <Text style={TEXT_STYLE}>{message}</Text>

      {details.map((detail) => (
        <DetailRow key={detail.label} label={detail.label} value={detail.value} />
      ))}

      {actionUrl ? (
        <PrimaryButton href={actionUrl}>{actionLabel ?? "Abrir o painel"}</PrimaryButton>
      ) : null}
    </EmailLayout>
  );
}

export default AdminAlert;
