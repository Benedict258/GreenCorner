import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireStaff } from "@/lib/auth";
import { navCounts } from "@/lib/admin/dashboard";
import { unreadNotifications } from "@/lib/messaging";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  // The chrome must never take every page down with it, so failed lookups show nothing.
  const [counts, notes] = await Promise.all([
    navCounts().catch(() => ({ orders: 0, requests: 0 })),
    unreadNotifications(8).catch(() => ({ items: [], unread: 0 })),
  ]);
  return (
    <AdminChrome
      staff={{ email: staff.email, role: staff.role }}
      counts={counts}
      notifications={notes.items.map((n) => ({ id: Number(n.id), title: n.title, body: n.body, link: n.link, at: new Date(n.created_at).toISOString(), read: !!n.read_at, kind: n.kind }))}
      unread={notes.unread}
    >
      {children}
    </AdminChrome>
  );
}
