import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Building2, Check, FileText, GraduationCap, Globe, Loader2, ReceiptText, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { PremiumShell } from "@/components/premium/PremiumShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminConfirmPayment,
  adminListInstitutions,
  adminListPayments,
  adminRejectPayment,
  adminRevokeInstitution,
  amIAdmin,
} from "@/lib/premium.functions";
import {
  adminDeleteDomainRule,
  adminListDomainRules,
  adminListVerifications,
  adminReviewVerification,
  adminRevokeVerification,
  adminSetDomainRule,
  adminVerificationDocs,
} from "@/lib/verification.functions";
import { formatRupiah } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — SEMAR-Dock" }, { name: "robots", content: "noindex" }] }),
  // Pemeriksaan ini hanya kenyamanan UI. Setiap fungsi server tetap memeriksa admin sendiri.
  beforeLoad: async () => {
    const r = await amIAdmin();
    if (!r.admin) throw redirect({ to: "/akun" });
  },
  component: AdminPage,
});

const TABS = [
  { id: "payments", label: "Pembayaran", icon: ReceiptText },
  { id: "verifications", label: "Verifikasi", icon: GraduationCap },
  { id: "domains", label: "Domain kampus", icon: Globe },
  { id: "institutions", label: "Institusi", icon: Building2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

function AdminPage() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<TabId>("payments");
  return (
    <PremiumShell email={user?.email} eyebrow="Admin" title={<>Dashboard <span className="text-gradient">Admin</span></>} desc="Antrean pembayaran, verifikasi mahasiswa, aturan domain, dan lisensi institusi.">
      <div role="tablist" className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition", tab === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === "payments" && <PaymentsTab />}
      {tab === "verifications" && <VerificationsTab />}
      {tab === "domains" && <DomainsTab />}
      {tab === "institutions" && <InstitutionsTab />}
    </PremiumShell>
  );
}

// ---------- komponen kecil ----------
function Empty({ children }: { children: string }) {
  return <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">{children}</p>;
}
function Loading() {
  return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
}
function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={cn("rounded-full px-3 py-1 text-xs font-medium", value === o.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tombol yang membuka isian alasan sebelum tindakan dijalankan (tolak/cabut wajib beralasan). */
function ReasonAction({ label, busy, onSubmit, danger = true }: { label: string; busy?: boolean; onSubmit: (reason: string) => void; danger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button size="sm" variant={danger ? "outline" : "default"} onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan (wajib)" maxLength={300} className="h-9 min-w-48 flex-1" />
      <Button size="sm" disabled={busy || reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>
        {busy ? <Loader2 className="animate-spin" /> : null} Kirim
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setReason(""); }}>Batal</Button>
    </div>
  );
}

// ---------- Pembayaran ----------
function PaymentsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListPayments);
  const confirm = useServerFn(adminConfirmPayment);
  const reject = useServerFn(adminRejectPayment);
  const [scope, setScope] = useState<"claimed" | "open" | "recent">("claimed");
  const q = useQuery({ queryKey: ["admin", "payments", scope], queryFn: () => list({ data: { scope } }), refetchInterval: 30_000 });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "payments"] });
  const ok = useMutation({ mutationFn: (orderId: string) => confirm({ data: { orderId } }), onSuccess: (r) => { toast.success(r.alreadyPaid ? "Sudah terkonfirmasi sebelumnya." : "Pembayaran dikonfirmasi."); done(); }, onError: (e) => toast.error(errMsg(e)) });
  const no = useMutation({ mutationFn: (v: { orderId: string; reason: string }) => reject({ data: v }), onSuccess: () => { toast.success("Pembayaran ditolak."); done(); }, onError: (e) => toast.error(errMsg(e)) });

  return (
    <section>
      <Chips value={scope} onChange={setScope} options={[{ id: "claimed", label: "Sudah klaim bayar" }, { id: "open", label: "Semua menunggu" }, { id: "recent", label: "50 terakhir" }]} />
      {q.isLoading ? <Loading /> : q.isError ? <Empty>{errMsg(q.error)}</Empty> : !q.data?.length ? <Empty>Tidak ada pembayaran di daftar ini.</Empty> : (
        <ul className="space-y-3">
          {q.data.map((p) => (
            <li key={p.orderId} className="glass rounded-3xl border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold">{p.label}</p>
                  <p className="text-sm text-muted-foreground">{p.email ?? "(email tidak ditemukan)"} · <span className="font-mono text-xs">{p.orderId}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Dibuat {fmt(p.createdAt)} · Klaim {fmt(p.claimedAt)}{p.paidAt ? ` · Lunas ${fmt(p.paidAt)}` : ""}</p>
                  {p.rejectReason && <p className="mt-1 text-xs text-destructive">Ditolak: {p.rejectReason}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold">{formatRupiah(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">kode unik {p.uniqueCode ?? "-"} · {p.status}</p>
                </div>
              </div>
              {p.status === "pending" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" disabled={ok.isPending} onClick={() => { if (confirmAmount(p.amount)) ok.mutate(p.orderId); }}>
                    <Check /> Konfirmasi lunas
                  </Button>
                  <ReasonAction label="Tolak" busy={no.isPending} onSubmit={(reason) => no.mutate({ orderId: p.orderId, reason })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
/** Konfirmasi ganda: admin diminta memastikan nominal mutasi cocok sebelum menyetujui. */
function confirmAmount(amount: number): boolean {
  return window.confirm(`Pastikan mutasi rekening menunjukkan masuk tepat ${formatRupiah(amount)}. Lanjut konfirmasi?`);
}

// ---------- Verifikasi ----------
function VerificationsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListVerifications);
  const docs = useServerFn(adminVerificationDocs);
  const review = useServerFn(adminReviewVerification);
  const revoke = useServerFn(adminRevokeVerification);
  const [status, setStatus] = useState<"pending" | "verified" | "rejected">("pending");
  const [links, setLinks] = useState<Record<string, { ktm: string | null; support: string | null }>>({});
  const q = useQuery({ queryKey: ["admin", "verifications", status], queryFn: () => list({ data: { status } }), refetchInterval: 60_000 });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "verifications"] });
  const act = useMutation({ mutationFn: (v: { userId: string; action: "approve" | "reject"; reason?: string }) => review({ data: v }), onSuccess: (_r, v) => { toast.success(v.action === "approve" ? "Disetujui." : "Ditolak."); done(); }, onError: (e) => toast.error(errMsg(e)) });
  const rev = useMutation({ mutationFn: (v: { userId: string; reason: string }) => revoke({ data: v }), onSuccess: () => { toast.success("Verifikasi dicabut."); done(); }, onError: (e) => toast.error(errMsg(e)) });
  const openDocs = useMutation({ mutationFn: (userId: string) => docs({ data: { userId } }), onSuccess: (r, userId) => setLinks((l) => ({ ...l, [userId]: r })), onError: (e) => toast.error(errMsg(e)) });

  return (
    <section>
      <Chips value={status} onChange={setStatus} options={[{ id: "pending", label: "Menunggu" }, { id: "verified", label: "Terverifikasi" }, { id: "rejected", label: "Ditolak" }]} />
      {q.isLoading ? <Loading /> : q.isError ? <Empty>{errMsg(q.error)}</Empty> : !q.data?.length ? <Empty>Tidak ada pengajuan di daftar ini.</Empty> : (
        <ul className="space-y-3">
          {q.data.map((v) => {
            const l = links[v.userId];
            return (
              <li key={v.userId} className="glass rounded-3xl border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold">{v.fullName ?? "(tanpa nama)"}</p>
                    <p className="text-sm text-muted-foreground">{v.accountEmail ?? "-"} · NIM {v.nim ?? `…${v.nimLast4 ?? "?"}`}</p>
                    <p className="text-sm text-muted-foreground">{[v.university, v.faculty, v.studyProgram, v.entryYear].filter(Boolean).join(" · ") || "-"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Email kampus: {v.campusEmail ?? "-"} {v.campusEmail ? (v.emailVerified ? "(OTP terverifikasi)" : "(belum OTP)") : ""} · Diajukan {fmt(v.submittedAt)}
                      {v.expiresAt ? ` · Berlaku sampai ${fmt(v.expiresAt)}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Skor otomatis: <strong className="text-foreground">{v.score ?? "-"}</strong></p>
                    {v.decisionSource && <p>Keputusan: {v.decisionSource}</p>}
                  </div>
                </div>

                {Array.isArray(v.flags) && v.flags.length > 0 && (
                  <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-xs text-destructive">Catatan sistem: {v.flags.join(", ")}</p>
                )}
                {v.rejectReason && <p className="mt-2 text-xs text-destructive">Alasan: {v.rejectReason}</p>}

                {v.ocrText && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Hasil baca KTM (OCR)</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-secondary/60 p-3">{v.ocrText}</pre>
                  </details>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {v.hasDocs && !l && (
                    <Button size="sm" variant="outline" disabled={openDocs.isPending} onClick={() => openDocs.mutate(v.userId)}>
                      <FileText /> Buka dokumen (2 menit)
                    </Button>
                  )}
                  {l?.ktm && <a className="text-sm text-primary underline" href={l.ktm} target="_blank" rel="noopener noreferrer">KTM</a>}
                  {l?.support && <a className="text-sm text-primary underline" href={l.support} target="_blank" rel="noopener noreferrer">KRS/surat</a>}
                  {l && !l.ktm && !l.support && <span className="text-xs text-muted-foreground">Dokumen sudah dihapus atau tidak ada.</span>}
                  {status === "pending" && (
                    <>
                      <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ userId: v.userId, action: "approve" })}><ShieldCheck /> Setujui</Button>
                      <ReasonAction label="Tolak" busy={act.isPending} onSubmit={(reason) => act.mutate({ userId: v.userId, action: "reject", reason })} />
                    </>
                  )}
                  {status === "verified" && <ReasonAction label="Cabut verifikasi" busy={rev.isPending} onSubmit={(reason) => rev.mutate({ userId: v.userId, reason })} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Domain kampus ----------
function DomainsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListDomainRules);
  const save = useServerFn(adminSetDomainRule);
  const del = useServerFn(adminDeleteDomainRule);
  const [domain, setDomain] = useState("");
  const [kind, setKind] = useState<"allow" | "block">("allow");
  const [note, setNote] = useState("");
  const q = useQuery({ queryKey: ["admin", "domains"], queryFn: () => list() });
  const done = () => qc.invalidateQueries({ queryKey: ["admin", "domains"] });
  const add = useMutation({ mutationFn: () => save({ data: { domain, kind, note } }), onSuccess: () => { toast.success("Aturan disimpan."); setDomain(""); setNote(""); done(); }, onError: (e) => toast.error(errMsg(e)) });
  const remove = useMutation({ mutationFn: (d: string) => del({ data: { domain: d } }), onSuccess: () => { toast.success("Aturan dihapus."); done(); }, onError: (e) => toast.error(errMsg(e)) });

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="glass h-fit rounded-3xl border border-border p-6">
        <p className="font-display text-lg font-semibold">Tambah / ubah aturan</p>
        <div className="mt-4 space-y-3">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="student.uns.ac.id" className="font-mono text-sm" />
          <div className="flex gap-2">
            {(["allow", "block"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>
                {k === "allow" ? "Izinkan" : "Blokir"}
              </button>
            ))}
          </div>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" maxLength={120} />
          <Button disabled={add.isPending || !domain.trim()} onClick={() => add.mutate()}>{add.isPending ? <Loader2 className="animate-spin" /> : <Check />} Simpan</Button>
          <p className="text-xs text-muted-foreground">Domain harus persis sama dengan domain email kampus. Menyimpan domain yang sudah ada akan menimpa aturan lamanya.</p>
        </div>
      </div>
      <div>
        {q.isLoading ? <Loading /> : q.isError ? <Empty>{errMsg(q.error)}</Empty> : !q.data?.length ? <Empty>Belum ada aturan domain.</Empty> : (
          <ul className="space-y-2">
            {q.data.map((r) => (
              <li key={r.domain} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm">{r.domain}</p>
                  {r.note && <p className="truncate text-xs text-muted-foreground">{r.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", r.kind === "allow" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive")}>{r.kind === "allow" ? "Izinkan" : "Blokir"}</span>
                  <Button size="icon" variant="ghost" aria-label={`Hapus ${r.domain}`} disabled={remove.isPending} onClick={() => remove.mutate(r.domain)}><X /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------- Institusi ----------
const INST_STATUS = { pending: "Menunggu pembayaran", active: "Aktif", revoked: "Dicabut" } as const;

function InstitutionsTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListInstitutions);
  const revoke = useServerFn(adminRevokeInstitution);
  const q = useQuery({ queryKey: ["admin", "institutions"], queryFn: () => list() });
  const rev = useMutation({
    mutationFn: (v: { couponId: string; reason: string }) => revoke({ data: v }),
    onSuccess: (r) => { toast.success(`Lisensi dicabut. ${r.released} pengguna dilepas.`); qc.invalidateQueries({ queryKey: ["admin", "institutions"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <section>
      {q.isLoading ? <Loading /> : q.isError ? <Empty>{errMsg(q.error)}</Empty> : !q.data?.length ? <Empty>Belum ada lisensi institusi.</Empty> : (
        <ul className="space-y-3">
          {q.data.map((i) => (
            <li key={i.id} className="glass rounded-3xl border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold">{i.institution}</p>
                  <p className="text-sm text-muted-foreground">Pembeli: {i.ownerEmail ?? "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Domain: {i.emailDomains.length ? i.emailDomains.join(", ") : "semua email boleh"}
                    {i.validUntil ? ` · Berlaku sampai ${fmt(i.validUntil)}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-display font-bold">{i.used}/{i.seats} pengguna</p>
                  <p className="text-xs text-muted-foreground">{i.expired ? "Masa berlaku berakhir" : INST_STATUS[i.status]}{i.code ? ` · ${i.code}` : ""}</p>
                </div>
              </div>
              {i.status !== "revoked" && (
                <div className="mt-4">
                  <ReasonAction label="Cabut lisensi" busy={rev.isPending} onSubmit={(reason) => { if (window.confirm(`Cabut lisensi ${i.institution}? Semua ${i.used} pengguna kehilangan akses sekarang.`)) rev.mutate({ couponId: i.id, reason }); }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
