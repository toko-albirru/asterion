import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BadgeCheck, Building2, Check, GraduationCap, KeyRound, Loader2, Sparkles, Ticket, User } from "lucide-react";
import { toast } from "sonner";
import { PremiumShell } from "@/components/premium/PremiumShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelSubscription, claimCoupon, createOrder, getBilling, getPremiumConfig } from "@/lib/premium.functions";
import {
  INSTITUTION_BASE_PRICE_IDR,
  MONTHLY_PRICE_IDR,
  MONTH_CHOICES,
  STUDENT_DISCOUNT_PCT,
  formatRupiah,
  planConflict,
  subscriptionAmount,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

const billingQuery = queryOptions({ queryKey: ["billing"], queryFn: () => getBilling() });
const configQuery = queryOptions({ queryKey: ["premium-config"], queryFn: () => getPremiumConfig(), staleTime: 60_000 });

export const Route = createFileRoute("/_authenticated/langganan")({
  head: () => ({
    meta: [
      { title: "Langganan Premium — SEMAR-Dock" },
      { name: "description", content: "Pilih Premium Mahasiswa, Premium Individu, atau Lisensi Institusi SEMAR-Dock." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(billingQuery), context.queryClient.ensureQueryData(configQuery)]);
  },
  component: SubscriptionPage,
});

const fmtDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const PLAN_NAME = { individual: "Premium Individu", student: "Premium Mahasiswa", institution: "Lisensi Institusi" } as const;

function SubscriptionPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: billing } = useSuspenseQuery(billingQuery);
  const { data: config } = useSuspenseQuery(configQuery);
  const create = useServerFn(createOrder);
  const cancel = useServerFn(cancelSubscription);
  const claim = useServerFn(claimCoupon);
  const [months, setMonths] = useState<number>(1);
  const [busy, setBusy] = useState<"individual" | "student" | "claim" | "cancel" | null>(null);
  const [code, setCode] = useState("");

  const lic = billing.license;
  const active = lic?.active ? lic : null;
  const conflict = (p: "individual" | "student") => planConflict(active ? { plan: active.plan, expiresAt: new Date(active.expiresAt) } : null, p);
  const ver = billing.verification;

  async function buy(plan: "individual" | "student") {
    setBusy(plan);
    try {
      const r = await create({ data: { kind: "subscription", plan, months } });
      await navigate({ to: "/bayar/$orderId", params: { orderId: r.orderId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tagihan.");
    } finally {
      setBusy(null);
    }
  }

  async function claimNow() {
    setBusy("claim");
    try {
      const r = await claim({ data: { code } });
      toast.success(`Lisensi ${r.institution} aktif sampai ${fmtDate(r.expiresAt)}.`);
      setCode("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["billing"] }), qc.invalidateQueries({ queryKey: ["licenses"] }), qc.invalidateQueries({ queryKey: ["notifications"] })]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memakai kupon.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelNow() {
    setBusy("cancel");
    try {
      const r = await cancel();
      toast.success(`Perpanjangan dihentikan. Akses Premium tetap aktif sampai ${fmtDate(r.expiresAt)}.`);
      await qc.invalidateQueries({ queryKey: ["billing"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PremiumShell
      email={user.email}
      eyebrow="Langganan"
      title={
        <>
          Premium <span className="text-gradient">SEMAR-Dock</span>
        </>
      }
      desc="Pilih jenis langganan yang sesuai. Satu akun hanya memiliki satu jenis langganan aktif pada satu waktu."
    >
      {!config.enabled && (
        <p className="mb-6 rounded-3xl border border-dashed border-border p-5 text-sm text-muted-foreground">Pembayaran belum aktif. Hubungi admin SEMAR-Dock.</p>
      )}

      <StatusCard lic={lic} onCancel={cancelNow} busy={busy === "cancel"} />

      {billing.openOrderId && (
        <Link to="/bayar/$orderId" params={{ orderId: billing.openOrderId }} className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-secondary px-5 py-4 text-sm font-medium">
          <span>Anda punya tagihan yang belum selesai.</span>
          <span className="text-primary">Lanjutkan pembayaran →</span>
        </Link>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Lama berlangganan</span>
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {MONTH_CHOICES.map((m) => (
            <button key={m} type="button" onClick={() => setMonths(m)} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", months === m ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {m} bln
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <PlanCard icon={<GraduationCap />} name="Premium Mahasiswa" tag={`Diskon ${STUDENT_DISCOUNT_PCT}%`} price={subscriptionAmount("student", months)} strike={MONTHLY_PRICE_IDR * months} per={months} bullets={["Untuk mahasiswa terverifikasi", "Verifikasi berlaku 1 tahun", "Semua fitur Premium"]} highlight>
          {ver.status === "verified" ? (
            <>
              <p className="mb-3 flex items-center gap-2 text-sm text-primary">
                <BadgeCheck className="h-4 w-4" /> Terverifikasi{ver.expiresAt ? ` sampai ${fmtDate(ver.expiresAt)}` : ""}
              </p>
              <BuyButton plan="student" busy={busy} blocked={conflict("student")} disabled={!config.enabled} onBuy={buy} />
            </>
          ) : (
            <>
              <VerificationNote status={ver.status} reason={ver.rejectReason} />
              {ver.status !== "pending" && (
                <Button asChild variant="hero" size="xl" className="w-full">
                  <Link to="/verifikasi-mahasiswa">Verifikasi mahasiswa</Link>
                </Button>
              )}
            </>
          )}
        </PlanCard>

        <PlanCard icon={<User />} name="Premium Individu" tag="Umum" price={subscriptionAmount("individual", months)} per={months} bullets={["Dosen, peneliti, profesional, umum", "Tanpa verifikasi", "Semua fitur Premium"]}>
          <BuyButton plan="individual" busy={busy} blocked={conflict("individual")} disabled={!config.enabled} onBuy={buy} />
        </PlanCard>

        <div className="glass flex flex-col rounded-3xl border border-border p-7 shadow-soft">
          <div className="flex items-center gap-2 text-primary [&_svg]:h-5 [&_svg]:w-5">
            <Building2 /> <span className="font-display text-sm font-semibold uppercase tracking-wider">Lisensi Institusi</span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold">
            mulai {formatRupiah(INSTITUTION_BASE_PRICE_IDR * 0.8)}
            <span className="text-base font-normal text-muted-foreground"> /tahun</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {["Satu kupon untuk mahasiswa, dosen, dan staf", "Diskon 5–20% menurut jumlah pengguna", "Pengguna cukup mengklaim kupon"].map((b) => (
              <li key={b} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
              </li>
            ))}
          </ul>
          <Button asChild variant="glass" size="xl" className="mt-auto w-full">
            <Link to="/institusi">Beli untuk institusi</Link>
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Total bayar ditambah kode unik Rp1–999 agar pembayaran Anda bisa dikenali. Pembayaran dikonfirmasi admin maksimal {config.confirmationHours} jam. Tidak ada refund. Perpanjangan dilakukan dengan membayar lagi.
      </p>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl border border-border p-7">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <Ticket className="h-5 w-5 text-primary" /> Punya kupon institusi?
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Gunakan akun dengan email institusi yang diizinkan. Kupon terikat pada akun Anda setelah berhasil diklaim.</p>
          <div className="mt-4 flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SMD-XXXX" className="font-mono" maxLength={40} />
            <Button variant="hero" size="pill" disabled={busy === "claim" || code.trim().length < 5} onClick={claimNow}>
              {busy === "claim" ? <Loader2 className="animate-spin" /> : <Sparkles />} Klaim
            </Button>
          </div>
        </div>
        <div className="glass rounded-3xl border border-border p-7">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <KeyRound className="h-5 w-5 text-primary" /> Token aplikasi
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Token Premium untuk aplikasi desktop ada di halaman Akun. Perpanjangan memakai token yang sama, jadi Anda tidak perlu memasukkan token baru.
          </p>
          <Button asChild variant="glass" size="pill" className="mt-4">
            <Link to="/akun">Buka halaman Akun</Link>
          </Button>
        </div>
      </section>

      {billing.payments.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Riwayat pembayaran</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-border">
            {billing.payments.map((p) => (
              <div key={p.orderId} className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(p.createdAt)} · {formatRupiah(p.amount)}
                  </p>
                  {p.rejectReason && <p className="mt-1 text-xs text-destructive">Alasan: {p.rejectReason}</p>}
                </div>
                <PaymentChip status={p.status} waiting={p.waitingAdmin} orderId={p.orderId} />
              </div>
            ))}
          </div>
        </section>
      )}
    </PremiumShell>
  );
}

function StatusCard({ lic, onCancel, busy }: { lic: Awaited<ReturnType<typeof getBilling>>["license"]; onCancel: () => void; busy: boolean }) {
  if (!lic || !lic.active) {
    return (
      <div className="glass rounded-3xl border border-dashed border-border p-6">
        <p className="font-display text-lg font-semibold">{lic ? "Langganan Anda sudah berakhir" : "Belum ada langganan aktif"}</p>
        <p className="mt-1 text-sm text-muted-foreground">Tanpa Premium, aplikasi berjalan dalam mode Gratis (hasil mentah saja).</p>
      </div>
    );
  }
  return (
    <div className="glass rounded-3xl border border-border p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Langganan aktif</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {PLAN_NAME[lic.plan]}
            {lic.institution ? ` · ${lic.institution}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Berlaku sampai {fmtDate(lic.expiresAt)} ({lic.daysLeft} hari lagi)
            {lic.cancelled ? " · perpanjangan dihentikan" : ""}
          </p>
          {lic.expiringSoon && <p className="mt-2 text-sm font-medium text-primary">Segera berakhir. Pilih paket di bawah untuk memperpanjang.</p>}
          {lic.source === "institution" && <p className="mt-2 text-sm text-muted-foreground">Dari lisensi institusi: tidak perlu membeli langganan sendiri.</p>}
        </div>
        {lic.source === "payment" && !lic.cancelled && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="glass" size="pill" disabled={busy}>
                Hentikan perpanjangan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hentikan perpanjangan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Anda tidak akan menerima pengingat perpanjangan. Akses Premium tetap aktif sampai {fmtDate(lic.expiresAt)}. Pembayaran yang sudah dilakukan tidak dapat dikembalikan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Kembali</AlertDialogCancel>
                <AlertDialogAction onClick={onCancel}>Hentikan</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

function PlanCard({ icon, name, tag, price, strike, per, bullets, highlight, children }: { icon: React.ReactNode; name: string; tag: string; price: number; strike?: number; per: number; bullets: string[]; highlight?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("relative flex flex-col rounded-3xl border bg-card p-7", highlight ? "ring-gradient border-border shadow-glow" : "border-border shadow-soft")}>
      <span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-xs font-bold text-primary-foreground">{tag}</span>
      <div className="flex items-center gap-2 text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon} <span className="font-display text-sm font-semibold uppercase tracking-wider">{name}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">
        {strike ? <span className="mr-2 text-lg font-normal text-muted-foreground line-through decoration-2">{formatRupiah(strike)}</span> : null}
        {formatRupiah(price)}
      </p>
      <p className="text-sm text-muted-foreground">untuk {per} bulan</p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
          </li>
        ))}
      </ul>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function BuyButton({ plan, busy, blocked, disabled, onBuy }: { plan: "individual" | "student"; busy: string | null; blocked: string | null; disabled: boolean; onBuy: (p: "individual" | "student") => void }) {
  return (
    <>
      <Button variant="hero" size="xl" className="w-full" disabled={disabled || blocked !== null || busy !== null} onClick={() => onBuy(plan)}>
        {busy === plan ? <Loader2 className="animate-spin" /> : <Sparkles />} Pilih paket ini
      </Button>
      {blocked && <p className="mt-2 text-xs text-muted-foreground">{blocked}</p>}
    </>
  );
}

function VerificationNote({ status, reason }: { status: string; reason: string | null }) {
  const text =
    status === "pending"
      ? "Pengajuan verifikasi Anda sedang diperiksa. Anda akan diberi tahu hasilnya."
      : status === "rejected"
        ? `Verifikasi ditolak${reason ? `: ${reason}` : "."} Anda bisa mengajukan ulang.`
        : status === "expired"
          ? "Masa verifikasi Anda berakhir. Perbarui untuk mendapat harga mahasiswa."
          : "Harga mahasiswa memerlukan verifikasi mahasiswa (KTM + status aktif).";
  return <p className="mb-3 text-sm text-muted-foreground">{text}</p>;
}

function PaymentChip({ status, waiting, orderId }: { status: string; waiting: boolean; orderId: string }) {
  if (status === "pending")
    return (
      <Link to="/bayar/$orderId" params={{ orderId }} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:underline">
        {waiting ? "Menunggu konfirmasi admin" : "Belum dibayar · lanjutkan"}
      </Link>
    );
  const map: Record<string, [string, string]> = {
    paid: ["Lunas", "bg-secondary text-secondary-foreground"],
    expired: ["Kedaluwarsa", "bg-muted text-muted-foreground"],
    failed: ["Ditolak", "bg-destructive/10 text-destructive"],
  };
  const [label, cls] = map[status] ?? [status, "bg-muted text-muted-foreground"];
  return <span className={cn("rounded-full px-3 py-1 text-xs font-medium", cls)}>{label}</span>;
}
