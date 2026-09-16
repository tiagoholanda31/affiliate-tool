import { PendingBellMenu } from "@/components/layout/pending-bell-menu";
import { getAdminPendingSummary } from "@/features/system/pending";

/**
 * Sino de pendências no header admin:
 * cadastros, a pagar, webhooks falhos e jobs com erro (últimas 48 h).
 */
export async function PendingBell() {
  const summary = await getAdminPendingSummary();
  return <PendingBellMenu summary={summary} />;
}
