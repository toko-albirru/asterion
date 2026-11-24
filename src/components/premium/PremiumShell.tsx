import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/landing/BrandMark";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { NotificationBell } from "@/components/premium/NotificationBell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Kerangka halaman Premium: sama dengan halaman Akun (header, tema, keluar) + lonceng notifikasi. */
export function PremiumShell({ email, eyebrow, title, desc, children }: { email?: string | null | undefined; eyebrow: string; title: ReactNode; desc?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="bg-hero pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Link to="/akun" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
            {email ?? "Akun"}
          </Link>
          <NotificationBell />
          <ThemeToggle />
          <Button variant="glass" size="pill" onClick={signOut}>
            <LogOut /> Keluar
          </Button>
        </div>
      </div>
      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-6">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{title}</h1>
        {desc && <p className="mt-2 max-w-2xl text-muted-foreground">{desc}</p>}
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}
