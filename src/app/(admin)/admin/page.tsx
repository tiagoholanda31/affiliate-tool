import { AdminDashboard } from "@/features/dashboard/components/admin-dashboard";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Administração" };

export default async function AdminDashboardPage() {
  await requireAdmin();
  return <AdminDashboard />;
}
