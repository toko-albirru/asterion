import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getNotifications, readNotifications } from "@/lib/premium.functions";
import { cn } from "@/lib/utils";

const fmt = (s: string) => new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Lonceng notifikasi dalam web (gratis, tanpa email). Ditandai terbaca saat ditutup. */
export function NotificationBell() {
  const qc = useQueryClient();
  const markRead = useServerFn(readNotifications);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => getNotifications(), refetchInterval: 60_000, staleTime: 30_000 });
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open && unread > 0) void markRead().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ""}`} className="glass relative grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Notifikasi</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi.</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className={cn("border-b border-border px-4 py-3 last:border-b-0", !n.read_at && "bg-secondary/50")}>
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{fmt(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
