import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Check, Clock, Copy, Loader2, Sparkles, Trash2, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createOrder, getMyInstitutions, getPremiumConfig, removeInstitutionMember, saveInstitutionDomains } from "@/lib/premium.functions";
import {
  INSTITUTION_BASE_PRICE_IDR,
  INSTITUTION_MAX_USERS,
  INSTITUTION_TERM_MONTHS,
  INSTITUTION_TIERS,
  formatRupiah,
  institutionAmount,
  institutionDiscountPct,
  isValidInstitutionUsers,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

const listQuery = queryOptions({ queryKey: ["institutions"], queryFn: () => getMyInstitutions() });
const configQuery = queryOptions({ queryKey: ["premium-config"], queryFn: () => getPremiumConfig(), staleTime: 60_000 });

export const Route = createFileRoute("/_authenticated/institusi")({
  head: () => ({
    meta: [
      { title: "Lisensi Institusi — SEMAR-Dock" },
      { name: "description", content: "Beli lisensi Premium SEMAR-Dock untuk mahasiswa, dosen, dan staf institusi Anda." },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(listQuery), context.queryClient.ensureQueryData(configQuery)]);
  },
  component: InstitutionPage,
});

const fmtDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function tierLabel(i: number): string {
  const prev = i === 0 ? 1 : INSTITUTION_TIERS[i - 1]!.maxUsers + 1;
  return i === INSTITUTION_TIERS.length - 1 ? `${prev}–${INSTITUTION_MAX_USERS} pengguna` : `${prev}–${INSTITUTION_TIERS[i]!.maxUsers} pengguna`;
}

function InstitutionPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: licenses } = useSuspenseQuery(listQuery);
  const { data: config } = useSuspenseQuery(configQuery);
  const create = useServerFn(createOrder);
  const [name, setName] = useState("");
  const [users, setUsers] = useState("100");
  const [domains, setDomains] = useState("");
  const [busy, setBusy] = useState(false);

  const n = Number(users);
  const validUsers = isValidInstitutionUsers(n);
  const price = validUsers ? institutionAmount(n) : null;

  async function buy() {
    if (!validUsers) return;
    setBusy(true);
    try {
      const r = await create({ data: { kind: "institution", institutionName: name, users: n, emailDomains: domains.split(/[\s,;]+/).filter(Boolean) } });
      await navigate({ to: "/bayar/$orderId", params: { orderId: r.orderId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tagihan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumShell
      email={user.email}
      eyebrow="Institusi"
      title={
        <>
          Lisensi <span className="text-gradient">Institusi</span>
        </>
      }
      desc="Satu lisensi untuk mahasiswa, dosen, dan staf. Pengguna cukup mengklaim kupon dengan email institusi, tanpa membayar sendiri."
    >
      {!config.enabled && <p className="mb-6 rounded-3xl border border-dashed border-border p-5 text-sm text-muted-foreground">Pembayaran belum aktif. Hubungi admin SEMAR-Dock.</p>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="glass rounded-3xl border border-border p-7">
          <div className="flex items-center gap-2 font-display text-lg font-semibold">
            <Building2 className="h-5 w-5 text-primary" /> Beli lisensi
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Nama institusi</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: UNS" maxLength={80} />
              <span className="mt-1 block text-xs text-muted-foreground">Ditampilkan di tagihan dan di daftar pembayaran admin.</span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Jumlah pengguna (kuota)</span>
              <Input value={users} onChange={(e) => setUsers(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="max-w-40" />
              {!validUsers && <span className="mt-1 block text-xs text-destructive">Isi 1–{INSTITUTION_MAX_USERS}.</span>}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Domain email yang diizinkan (opsional)</span>
              <Textarea value={domains} onChange={(e) => setDomains(e.target.value)} rows={3} placeholder={"@staff.uns.ac.id\n@student.uns.ac.id"} className="font-mono text-xs" />
              <span className="mt-1 block text-xs text-muted-foreground">Satu per baris atau dipisah koma; bisa lebih dari satu. Kosong = semua email boleh mengklaim. Domain harus persis sama (subdomain dihitung terpisah).</span>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-2xl bg-secondary/60 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Harga {INSTITUTION_TERM_MONTHS / 12} tahun{validUsers ? ` · diskon ${institutionDiscountPct(n)}%` : ""}</p>
              <p className="font-display text-3xl font-bold">
                {price !== null && <span className="mr-2 text-lg font-normal text-muted-foreground line-through decoration-2">{formatRupiah(INSTITUTION_BASE_PRICE_IDR)}</span>}
                {price !== null ? formatRupiah(price) : "—"}
              </p>
            </div>
            <Button variant="hero" size="xl" disabled={busy || !validUsers || name.trim().length < 2 || !config.enabled} onClick={buy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Lanjut bayar
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Total bayar ditambah kode unik Rp1–999. Pembayaran dikonfirmasi admin maksimal {config.confirmationHours} jam. Tidak ada refund. Lisensi berlaku 1 tahun sejak dikonfirmasi.
          </p>
        </section>

        <aside className="h-fit rounded-3xl border border-border bg-card p-6 text-sm shadow-soft">
          <p className="font-display text-base font-semibold">Harga per tahun</p>
          <div className="mt-3 divide-y divide-border">
            {INSTITUTION_TIERS.map((t, i) => (
              <div key={t.maxUsers} className={cn("flex items-center justify-between gap-3 py-2.5", validUsers && institutionDiscountPct(n) === t.pct && "font-semibold text-primary")}>
                <span>{tierLabel(i)}</span>
                <span className="text-right">
                  {formatRupiah(institutionAmount(t.maxUsers))} <span className="text-xs text-muted-foreground">(−{t.pct}%)</span>
                </span>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            {["Satu kupon dipakai semua pengguna, sesuai kuota", "Pengguna dengan lisensi aktif tidak perlu beli sendiri", "Lisensi berakhir otomatis saat masa berlaku habis"].map((b) => (
              <li key={b} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {b}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {licenses.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl font-semibold">Lisensi Anda</h2>
          <div className="mt-4 space-y-5">
            {licenses.map((l) => (
              <LicenseCard key={l.id} l={l} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm text-muted-foreground">
        Anggota institusi? Klaim kupon di halaman{" "}
        <Link to="/langganan" className="font-medium text-primary hover:underline">
          Langganan
        </Link>
        .
      </p>
    </PremiumShell>
  );
}

type OwnedLicense = Awaited<ReturnType<typeof getMyInstitutions>>[number];

function LicenseCard({ l }: { l: OwnedLicense }) {
  const qc = useQueryClient();
  const saveDomains = useServerFn(saveInstitutionDomains);
  const removeMember = useServerFn(removeInstitutionMember);
  const [domains, setDomains] = useState(l.emailDomains.join("\n"));
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["institutions"] });
  const pct = Math.min(100, Math.round((l.used / Math.max(1, l.seats)) * 100));

  async function copy() {
    if (!l.code) return;
    try {
      await navigator.clipboard.writeText(l.code);
      toast.success("Kode kupon disalin.");
    } catch {
      toast.error("Tidak bisa menyalin. Salin kode secara manual.");
    }
  }

  async function save() {
    setBusy("domains");
    try {
      const r = await saveDomains({ data: { couponId: l.id, domains } });
      setDomains(r.domains.join("\n"));
      toast.success(r.domains.length ? "Domain email disimpan." : "Pembatasan domain dihapus.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(userId: string) {
    setBusy(userId);
    try {
      await removeMember({ data: { couponId: l.id, userId } });
      toast.success("Akses pengguna dicabut.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mencabut akses.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass rounded-3xl border border-border p-6 shadow-soft sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-bold">{l.institution}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {l.status === "active" && !l.expired && l.validUntil ? `Aktif sampai ${fmtDate(l.validUntil)}` : l.expired ? "Masa berlaku berakhir" : l.status === "revoked" ? "Dibatalkan" : "Menunggu pembayaran/konfirmasi admin"}
          </p>
        </div>
        {l.status === "pending" && (
          <Link to="/langganan" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:underline">
            <Clock className="h-3.5 w-3.5" /> Lihat status tagihan
          </Link>
        )}
      </div>

      {l.status === "active" && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">Kode kupon</span>
            <span className="font-mono text-lg font-semibold tracking-wider">{l.code}</span>
            <Button variant="glass" size="sm" onClick={copy}>
              <Copy /> Salin
            </Button>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="h-4 w-4 text-primary" /> Kuota terpakai
              </span>
              <span className="text-muted-foreground">
                {l.used} / {l.seats}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium">Domain email yang diizinkan</p>
              <Textarea value={domains} onChange={(e) => setDomains(e.target.value)} rows={3} className="mt-2 font-mono text-xs" placeholder="Kosong = semua email boleh mengklaim" />
              <Button variant="glass" size="pill" className="mt-2" disabled={busy !== null} onClick={save}>
                {busy === "domains" && <Loader2 className="animate-spin" />} Simpan domain
              </Button>
            </div>
            <div>
              <p className="text-sm font-medium">Pengguna ({l.users.length})</p>
              {l.users.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Belum ada yang mengklaim. Bagikan kode kupon ke anggota institusi.</p>
              ) : (
                <div className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-2xl border border-border bg-card">
                  {l.users.map((u) => (
                    <div key={u.userId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{u.email}</p>
                        <p className="text-xs text-muted-foreground">Klaim {u.claimedAt ? fmtDate(u.claimedAt) : "-"}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Cabut akses ${u.email}`} disabled={busy !== null}>
                            {busy === u.userId ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cabut akses pengguna ini?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {u.email} kehilangan akses Premium dari lisensi ini sekarang, dan kursinya kembali ke kuota. Pengguna dapat mengklaim lagi bila masih memenuhi syarat.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void remove(u.userId)}>Cabut akses</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
