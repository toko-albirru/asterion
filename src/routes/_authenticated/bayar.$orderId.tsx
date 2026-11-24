import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Copy, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PremiumShell } from "@/components/premium/PremiumShell";
import { Button } from "@/components/ui/button";
import { cancelOrder, getOrder, markPaid } from "@/lib/premium.functions";
import { formatRupiah } from "@/lib/plans";

const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order", orderId],
    queryFn: () => getOrder({ data: { orderId } }),
    // Selama menunggu admin, halaman memeriksa sendiri tiap 20 detik.
    refetchInterval: (q) => (q.state.data?.status === "pending" && q.state.data.waitingAdmin ? 20_000 : false),
  });

export const Route = createFileRoute("/_authenticated/bayar/$orderId")({
  head: () => ({ meta: [{ title: "Pembayaran — SEMAR-Dock" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(orderQuery(params.orderId)),
  errorComponent: () => (
    <PremiumShell eyebrow="Pembayaran" title="Tagihan tidak ditemukan">
      <Button asChild variant="hero" size="pill">
        <Link to="/langganan">Kembali ke Langganan</Link>
      </Button>
    </PremiumShell>
  ),
  component: CheckoutPage,
});

const fmtDateTime = (s: string) => new Date(s).toLocaleString("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

function CheckoutPage() {
  const { user } = Route.useRouteContext();
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: o } = useSuspenseQuery(orderQuery(orderId));
  const claim = useServerFn(markPaid);
  const cancel = useServerFn(cancelOrder);
  const [busy, setBusy] = useState<"claim" | "cancel" | null>(null);

  const { data: qrImage } = useQuery({
    queryKey: ["order-qr", o.qrString],
    queryFn: () => QRCode.toDataURL(o.qrString!, { errorCorrectionLevel: "M", margin: 2, width: 360 }),
    enabled: Boolean(o.qrString),
    staleTime: Infinity,
  });

  // Saat status berubah menjadi lunas, segarkan data akun & notifikasi.
  useEffect(() => {
    if (o.status === "paid") void Promise.all([qc.invalidateQueries({ queryKey: ["billing"] }), qc.invalidateQueries({ queryKey: ["licenses"] }), qc.invalidateQueries({ queryKey: ["notifications"] })]);
  }, [o.status, qc]);

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} disalin.`);
  }

  async function iHavePaid() {
    setBusy("claim");
    try {
      await claim({ data: { orderId } });
      await qc.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success("Terima kasih. Pembayaran Anda masuk antrean pemeriksaan admin.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim.");
    } finally {
      setBusy(null);
    }
  }

  async function cancelNow() {
    setBusy("cancel");
    try {
      await cancel({ data: { orderId } });
      await qc.invalidateQueries({ queryKey: ["billing"] });
      await navigate({ to: "/langganan" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membatalkan.");
      setBusy(null);
    }
  }

  return (
    <PremiumShell email={user.email} eyebrow="Pembayaran" title={o.label}>
      {o.status === "paid" && (
        <Result icon={<CheckCircle2 className="h-6 w-6 text-primary" />} title="Pembayaran dikonfirmasi">
          {o.couponCode ? (
            <>
              <p className="text-sm text-muted-foreground">Lisensi institusi aktif. Bagikan kode kupon ini kepada mahasiswa, dosen, dan staf Anda:</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="rounded-2xl bg-muted px-4 py-3 font-mono text-xl font-semibold tracking-wider">{o.couponCode}</code>
                <Button variant="glass" size="pill" onClick={() => copy(o.couponCode!, "Kode kupon")}>
                  <Copy /> Salin
                </Button>
              </div>
              <Button asChild variant="hero" size="pill" className="mt-5">
                <Link to="/institusi">Kelola lisensi institusi</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Premium Anda sudah aktif. Token untuk aplikasi desktop ada di halaman Akun.</p>
              <Button asChild variant="hero" size="pill" className="mt-5">
                <Link to="/akun">Lihat token</Link>
              </Button>
            </>
          )}
        </Result>
      )}

      {o.status === "failed" && (
        <Result icon={<XCircle className="h-6 w-6 text-destructive" />} title="Pembayaran ditolak">
          <p className="text-sm text-muted-foreground">Alasan: {o.rejectReason ?? "-"}</p>
          <p className="mt-2 text-sm text-muted-foreground">Jika Anda merasa ini keliru, hubungi admin dengan bukti pembayaran.</p>
          <Button asChild variant="hero" size="pill" className="mt-5">
            <Link to="/langganan">Kembali ke Langganan</Link>
          </Button>
        </Result>
      )}

      {o.status === "expired" && (
        <Result icon={<Clock className="h-6 w-6 text-muted-foreground" />} title="Tagihan kedaluwarsa">
          <p className="text-sm text-muted-foreground">Tagihan ini tidak dibayar tepat waktu. Jika Anda sudah terlanjur membayar, hubungi admin dengan bukti pembayaran. Jika belum, buat tagihan baru.</p>
          <Button asChild variant="hero" size="pill" className="mt-5">
            <Link to="/langganan">Buat tagihan baru</Link>
          </Button>
        </Result>
      )}

      {o.status === "pending" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="glass flex flex-col items-center rounded-3xl border border-border p-7 shadow-soft">
            {qrImage ? (
              <img src={qrImage} alt={`QRIS ${o.merchantName}`} className="aspect-square w-full max-w-[320px] rounded-2xl bg-white p-2" />
            ) : (
              <div className="grid aspect-square w-full max-w-[320px] place-items-center rounded-2xl bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Scan dengan GoPay, OVO, DANA, ShopeePay, atau aplikasi m-banking apa pun.
              {o.merchantName ? (
                <>
                  <br />
                  Penerima: <strong className="text-foreground">{o.merchantName}</strong>
                </>
              ) : null}
            </p>
            {qrImage && (
              <a href={qrImage} download={`qris-${o.orderId}.png`} className="mt-2 text-sm font-medium text-primary hover:underline">
                Unduh QR
              </a>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-card p-7">
              <p className="text-sm text-muted-foreground">Total yang harus dibayar</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="font-display text-4xl font-bold">{formatRupiah(o.amount)}</p>
                <Button variant="glass" size="pill" onClick={() => copy(String(o.amount), "Nominal")}>
                  <Copy /> Salin
                </Button>
              </div>
              <dl className="mt-5 space-y-2 text-sm">
                <Row label="Harga" value={formatRupiah(o.baseAmount)} />
                {o.discountIdr > 0 && <Row label="Sudah termasuk diskon" value={formatRupiah(o.discountIdr)} />}
                <Row label={`Kode unik (#${o.uniqueCode})`} value={formatRupiah(o.uniqueCode)} />
              </dl>
              <p className="mt-4 flex gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Bayar <strong>tepat {formatRupiah(o.amount)}</strong> sampai digit terakhir. Kode unik membantu admin mengenali pembayaran Anda.
                </span>
              </p>
              {o.expiresAt && !o.waitingAdmin && <p className="mt-3 text-xs text-muted-foreground">Tagihan berlaku sampai {fmtDateTime(o.expiresAt)}.</p>}
            </div>

            {o.waitingAdmin ? (
              <div className="rounded-3xl border border-primary/40 bg-secondary p-6">
                <p className="flex items-center gap-2 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin" /> Menunggu konfirmasi admin
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pembayaran Anda sedang diperiksa. Proses maksimal <strong>{o.confirmationHours} jam</strong>. Halaman ini diperbarui otomatis, dan Anda juga akan mendapat notifikasi di lonceng.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Button variant="hero" size="xl" onClick={iHavePaid} disabled={busy !== null}>
                  {busy === "claim" && <Loader2 className="animate-spin" />} Saya sudah bayar
                </Button>
                <Button variant="glass" size="xl" onClick={cancelNow} disabled={busy !== null}>
                  Batalkan tagihan
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Tekan “Saya sudah bayar” hanya setelah transfer berhasil. Setelah itu, pembayaran diperiksa admin maksimal {o.confirmationHours} jam. Tidak ada refund.</p>
          </div>
        </div>
      )}
    </PremiumShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Result({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass max-w-xl rounded-3xl border border-border p-7 shadow-soft">
      <div className="flex items-center gap-3 font-display text-xl font-semibold">
        {icon} {title}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
