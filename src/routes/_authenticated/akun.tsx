import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Copy, KeyRound, LogOut, Monitor, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";
import { PurchaseCard } from "@/components/account/PurchaseCard";
import { PaymentPanel } from "@/components/payment/PaymentPanel";
import { BrandMark } from "@/components/landing/BrandMark";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PRO_PERIOD_DAYS, PRO_PRICE_IDR, daysLeft, formatRupiah } from "@/lib/license";
import { issueProToken } from "@/lib/license.functions";
import { getPaymentMode } from "@/lib/payment.functions";
import { cn } from "@/lib/utils";

const licensesQuery = queryOptions({
  queryKey: ["licenses"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("licenses")
      .select("id, token, plan, starts_at, expires_at, device_id, device_label, activated_at, created_at")
      .order("expires_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

const modeQuery = queryOptions({
  queryKey: ["payment-mode"],
  queryFn: () => getPaymentMode(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_authenticated/akun")({
  head: () => ({
    meta: [
      { title: "Akun & Token Pro — SEMAR-Dock" },
      { name: "description", content: "Ambil dan kelola token Pro SEMAR-Dock Anda." },
      { property: "og:title", content: "Akun & Token Pro — SEMAR-Dock" },
      { property: "og:description", content: "Ambil dan kelola token Pro SEMAR-Dock Anda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(licensesQuery),
      context.queryClient.ensureQueryData(modeQuery),
    ]);
  },
  component: AccountPage,
});

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: licenses } = useSuspenseQuery(licensesQuery);
  const issue = useServerFn(issueProToken);
  const { data: mode } = useSuspenseQuery(modeQuery);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const active = licenses.filter((l) => new Date(l.expires_at) > now);
  const current = active[0] ?? null; // newest token; a renewal already includes the remaining days

  async function getToken() {
    setBusy(true);
    try {
      await issue();
      await queryClient.invalidateQueries({ queryKey: ["licenses"] });
      toast.success("Token Pro baru sudah siap.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat token.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="bg-hero pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <BrandMark />
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
          <ThemeToggle />
          <Button variant="glass" size="pill" onClick={signOut}>
            <LogOut /> Keluar
          </Button>
        </div>
      </div>

      <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-6">
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary">Akun</p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Token <span className="text-gradient">Pro</span> Anda
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          {mode === "promo" ? `Satu token berlaku ${PRO_PERIOD_DAYS} hari` : mode === "qris" ? "Token berlaku selama langganan Premium aktif; perpanjangan memakai token yang sama" : "Satu token berlaku sesuai jumlah hari yang Anda beli"} untuk satu perangkat. Masukkan di aplikasi SEMAR-Dock lewat tombol{" "}
          <strong className="text-foreground">Aktifkan Pro</strong>.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {current ? <TokenCard license={current} now={now} /> : <EmptyCard />}

          {mode === "promo" ? (
            <div className="ring-gradient relative flex flex-col rounded-3xl border border-border bg-card p-7 shadow-glow">
              <span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-xs font-bold text-primary-foreground">
                Gratis sementara
              </span>
              <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary">Pro · 1 bulan</p>
              <p className="mt-3 font-display text-4xl font-bold">
                <span className="text-muted-foreground line-through decoration-2">{formatRupiah(PRO_PRICE_IDR)}</span> <span>Rp 0</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pembayaran online segera hadir. Untuk saat ini token Pro bisa diambil tanpa bayar.
              </p>
              <Button variant="hero" size="xl" className="mt-6" disabled={busy} onClick={getToken}>
                <Sparkles /> {current ? "Perpanjang token" : "Ambil token Pro"}
              </Button>
              {current && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Perpanjangan bisa diambil kapan saja; sisa hari token saat ini tetap dihitung.
                </p>
              )}
            </div>
          ) : mode === "qris" ? (
            <QrisCta hasToken={current !== null} />
          ) : (
            <PurchaseCard hasToken={current !== null} />
          )}
        </div>

        {mode !== "promo" && mode !== "qris" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" /> Mewakili institusi?{" "}
            <Link to="/institusi" className="font-medium text-primary hover:underline">
              Beli kupon institusi
            </Link>
          </p>
        )}

        {mode !== "promo" && mode !== "qris" && <PaymentPanel />}

        {licenses.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-xl font-semibold">Riwayat token</h2>
            <div className="mt-4 overflow-hidden rounded-3xl border border-border">
              {licenses.map((l) => {
                const expired = new Date(l.expires_at) <= now;
                return (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4 last:border-b-0">
                    <code className="font-mono text-sm">{l.token}</code>
                    <span className="text-sm text-muted-foreground">
                      {fmtDate(l.starts_at)} – {fmtDate(l.expires_at)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        expired ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {expired ? "Habis" : "Aktif"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

type License = {
  token: string;
  expires_at: string;
  device_id: string | null;
  device_label: string | null;
  activated_at: string | null;
};

function TokenCard({ license, now }: { license: License; now: Date }) {
  const [copied, setCopied] = useState(false);
  const left = daysLeft(new Date(license.expires_at), now);
  const progress = Math.min(100, (left / PRO_PERIOD_DAYS) * 100);

  async function copy() {
    await navigator.clipboard.writeText(license.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="glass rounded-3xl border border-border p-7 shadow-soft">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <KeyRound className="h-4 w-4 text-primary" /> Token aktif
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="rounded-2xl bg-muted px-4 py-3 font-mono text-lg font-medium tracking-wider sm:text-xl">
          {license.token}
        </code>
        <Button variant="glass" size="pill" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sisa masa aktif</span>
          <span className="font-semibold">{left} hari</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Berlaku sampai {fmtDate(license.expires_at)}</p>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
        <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        {license.device_id ? (
          <span>
            Terpasang di <strong>{license.device_label || "perangkat Anda"}</strong>
            {license.activated_at ? ` sejak ${fmtDate(license.activated_at)}` : ""}. Token ini tidak bisa dipakai di perangkat lain.
          </span>
        ) : (
          <span>Belum dipakai. Perangkat pertama yang memasukkan token ini akan terkunci padanya.</span>
        )}
      </div>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="glass flex flex-col justify-center rounded-3xl border border-dashed border-border p-7">
      <KeyRound className="h-6 w-6 text-primary" />
      <p className="mt-4 font-display text-xl font-semibold">Belum ada token aktif</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tanpa token, aplikasi berjalan dalam mode Gratis (hasil mentah saja). Ambil token Pro untuk membuka analisis hasil docking.
      </p>
    </div>
  );
}

function QrisCta({ hasToken }: { hasToken: boolean }) {
  return (
    <div className="ring-gradient relative flex flex-col rounded-3xl border border-border bg-card p-7 shadow-glow">
      <p className="font-display text-sm font-semibold uppercase tracking-wider text-primary">Premium</p>
      <p className="mt-3 font-display text-2xl font-bold">{hasToken ? "Perpanjang atau ganti paket" : "Berlangganan Premium"}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Premium Mahasiswa (diskon 15%), Premium Individu, atau Lisensi Institusi. Pembayaran lewat QRIS, dikonfirmasi admin.
      </p>
      <Button asChild variant="hero" size="xl" className="mt-6">
        <Link to="/langganan">
          <Sparkles /> Lihat paket
        </Link>
      </Button>
    </div>
  );
}
