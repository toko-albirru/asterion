import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, Clock, FileText, GraduationCap, Loader2, Mail, ShieldCheck, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PremiumShell } from "@/components/premium/PremiumShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { measureQuality, ocrImage, uploadToSlot } from "@/lib/student-browser";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, assessImageQuality, parseKtmText, type ImageMetrics } from "@/lib/student";
import { createUploadSlot, getVerificationState, sendCampusOtp, submitStudentVerification, verifyCampusOtp } from "@/lib/verification.functions";
import { cn } from "@/lib/utils";

const stateQuery = queryOptions({ queryKey: ["verification"], queryFn: () => getVerificationState() });

export const Route = createFileRoute("/_authenticated/verifikasi-mahasiswa")({
  head: () => ({
    meta: [
      { title: "Verifikasi Mahasiswa — SEMAR-Dock" },
      { name: "description", content: "Verifikasi status mahasiswa untuk mendapat diskon 15% Premium SEMAR-Dock." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(stateQuery);
  },
  component: VerificationPage,
});

const fmtDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const ACCEPT = ALLOWED_MIME.join(",");

type Method = "otp" | "krs" | "surat";
type Fields = { nim: string; name: string; university: string; faculty: string; studyProgram: string; entryYear: string };
const EMPTY: Fields = { nim: "", name: "", university: "", faculty: "", studyProgram: "", entryYear: "" };
type Analysis = { state: "idle" | "running" | "done"; pct: number; metrics: ImageMetrics | null; engine: string | null; issues: string[]; ocrText: string; note: string | null };
const IDLE: Analysis = { state: "idle", pct: 0, metrics: null, engine: null, issues: [], ocrText: "", note: null };

function VerificationPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(stateQuery);
  const { verification: v, config } = data;
  const slot = useServerFn(createUploadSlot);
  const sendOtp = useServerFn(sendCampusOtp);
  const checkOtp = useServerFn(verifyCampusOtp);
  const submit = useServerFn(submitStudentVerification);

  const [ktm, setKtm] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(IDLE);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [method, setMethod] = useState<Method>(config.otpAvailable ? "otp" : "krs");
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpOk, setOtpOk] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<"otp-send" | "otp-check" | "submit" | null>(null);

  const showForm = v.status === "unverified" || v.status === "rejected" || v.status === "expired" || v.canRenew;
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const isPdf = ktm?.type === "application/pdf";

  function checkFile(f: File): boolean {
    if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) {
      toast.error("Format berkas harus JPG, PNG, atau PDF.");
      return false;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(`Ukuran berkas maksimal ${config.maxUploadMb} MB.`);
      return false;
    }
    return true;
  }

  async function pickKtm(f: File | undefined) {
    if (!f || !checkFile(f)) return;
    setKtm(f);
    if (f.type === "application/pdf") {
      setAnalysis({ ...IDLE, state: "done", note: "PDF tidak dibaca otomatis. Isi data secara manual; pengajuan akan diperiksa admin." });
      return;
    }
    setAnalysis({ ...IDLE, state: "running" });
    let metrics: ImageMetrics | null = null;
    let engine: string | null = null;
    let issues: string[] = [];
    let text = "";
    let note: string | null = null;
    try {
      const m = await measureQuality(f);
      metrics = m.metrics;
      engine = m.engine;
      issues = assessImageQuality(m.metrics).issues;
    } catch {
      note = "Pemeriksaan kualitas gambar gagal. Pengajuan akan diperiksa admin.";
    }
    try {
      text = await ocrImage(f, (pct) => setAnalysis((a) => ({ ...a, pct })));
      const p = parseKtmText(text);
      setFields((cur) => ({
        nim: cur.nim || p.nim || "",
        name: cur.name || p.name || "",
        university: cur.university || p.university || "",
        faculty: cur.faculty || p.faculty || "",
        studyProgram: cur.studyProgram || p.studyProgram || "",
        entryYear: cur.entryYear || (p.entryYear ? String(p.entryYear) : ""),
      }));
      if (!p.nim && !p.name) note = "Teks KTM tidak terbaca jelas. Isi data secara manual.";
    } catch {
      note = "Pembacaan otomatis gagal. Isi data secara manual.";
    }
    setAnalysis({ state: "done", pct: 100, metrics, engine, issues, ocrText: text, note });
  }

  async function sendCode() {
    setBusy("otp-send");
    try {
      const r = await sendOtp({ data: { email: otpEmail } });
      setOtpEmail(r.email);
      setOtpSent(true);
      setOtpCode("");
      setOtpOk(null);
      toast.success(`Kode dikirim ke ${r.email}. Berlaku 10 menit.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim kode.");
    } finally {
      setBusy(null);
    }
  }

  async function checkCode(code: string) {
    setBusy("otp-check");
    try {
      const r = await checkOtp({ data: { code } });
      setOtpOk(r.email);
      toast.success("Email kampus terverifikasi.");
    } catch (e) {
      setOtpCode("");
      toast.error(e instanceof Error ? e.message : "Kode salah.");
    } finally {
      setBusy(null);
    }
  }

  const problem = !ktm
    ? "Unggah foto/scan KTM."
    : fields.nim.trim().length < 5 || fields.name.trim().length < 3 || fields.university.trim().length < 3
      ? "Lengkapi NIM, nama, dan universitas sesuai KTM."
      : method === "otp" && !otpOk
        ? "Verifikasi email kampus dengan kode OTP."
        : method !== "otp" && !supportFile
          ? method === "krs"
            ? "Unggah KRS semester berjalan."
            : "Unggah surat keterangan mahasiswa aktif."
          : !agree
            ? "Centang pernyataan bahwa data Anda benar."
            : null;

  async function send() {
    if (problem || !ktm) return;
    setBusy("submit");
    try {
      const ktmSlot = await slot({ data: { mime: ktm.type, bytes: ktm.size } });
      await uploadToSlot(ktmSlot, ktm);
      let supportPath: string | null = null;
      if (method !== "otp" && supportFile) {
        const s2 = await slot({ data: { mime: supportFile.type, bytes: supportFile.size } });
        await uploadToSlot(s2, supportFile);
        supportPath = s2.path;
      }
      const r = await submit({
        data: {
          ktmPath: ktmSlot.path,
          isPdf,
          supportKind: method,
          supportPath,
          fields: {
            nim: fields.nim,
            name: fields.name,
            university: fields.university,
            faculty: fields.faculty || null,
            studyProgram: fields.studyProgram || null,
            entryYear: fields.entryYear ? Number(fields.entryYear) : null,
          },
          ocrText: analysis.ocrText,
          quality: analysis.metrics,
        },
      });
      toast.success(r.status === "verified" ? "Verifikasi berhasil. Harga mahasiswa kini berlaku." : "Pengajuan diterima dan akan diperiksa admin.");
      await Promise.all(["verification", "billing", "notifications"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pengajuan.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PremiumShell
      email={user.email}
      eyebrow="Verifikasi"
      title={
        <>
          Verifikasi <span className="text-gradient">Mahasiswa</span>
        </>
      }
      desc="Mahasiswa terverifikasi mendapat Premium Rp42.500/bulan (diskon tetap 15%). Verifikasi berlaku 1 tahun."
    >
      <StatusBanner v={v} reviewHours={config.reviewHours} />

      {showForm && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Step n={1} title="Unggah KTM" icon={<Upload />}>
              <p className="text-sm text-muted-foreground">Foto atau scan KTM yang jelas (JPG/PNG/PDF, maksimal {config.maxUploadMb} MB). Teks dibaca otomatis di perangkat Anda untuk mengisi data.</p>
              <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm hover:bg-muted">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{ktm ? ktm.name : "Pilih berkas KTM"}</span>
                </span>
                <span className="shrink-0 font-medium text-primary">Pilih</span>
                <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void pickKtm(e.target.files?.[0])} />
              </label>
              {analysis.state === "running" && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Membaca KTM… {analysis.pct > 0 ? `${analysis.pct}%` : "menyiapkan"}
                </p>
              )}
              {analysis.state === "done" && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {analysis.issues.map((i) => (
                    <li key={i} className="flex gap-2 text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {i}
                    </li>
                  ))}
                  {analysis.note && (
                    <li className="flex gap-2 text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {analysis.note}
                    </li>
                  )}
                  {analysis.metrics && analysis.issues.length === 0 && (
                    <li className="flex gap-2 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Kualitas gambar baik.
                    </li>
                  )}
                </ul>
              )}
            </Step>

            <Step n={2} title="Periksa data" icon={<GraduationCap />}>
              <p className="text-sm text-muted-foreground">Pastikan sesuai KTM. Perbaiki bila hasil pembacaan keliru.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="NIM *">
                  <Input value={fields.nim} onChange={set("nim")} maxLength={30} inputMode="text" autoComplete="off" />
                </Field>
                <Field label="Nama lengkap *">
                  <Input value={fields.name} onChange={set("name")} maxLength={100} autoComplete="off" />
                </Field>
                <Field label="Universitas *" wide>
                  <Input value={fields.university} onChange={set("university")} maxLength={100} autoComplete="off" />
                </Field>
                <Field label="Fakultas">
                  <Input value={fields.faculty} onChange={set("faculty")} maxLength={100} autoComplete="off" />
                </Field>
                <Field label="Program studi">
                  <Input value={fields.studyProgram} onChange={set("studyProgram")} maxLength={100} autoComplete="off" />
                </Field>
                <Field label="Tahun masuk">
                  <Input value={fields.entryYear} onChange={set("entryYear")} maxLength={4} inputMode="numeric" autoComplete="off" />
                </Field>
              </div>
            </Step>

            <Step n={3} title="Pastikan masih mahasiswa aktif" icon={<ShieldCheck />}>
              <div className="flex flex-wrap gap-2">
                {([
                  ["otp", "OTP email kampus"],
                  ["krs", "KRS semester ini"],
                  ["surat", "Surat keterangan aktif"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    disabled={k === "otp" && !config.otpAvailable}
                    onClick={() => setMethod(k)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      method === k ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!config.otpAvailable && <p className="mt-2 text-xs text-muted-foreground">OTP email belum tersedia saat ini. Gunakan KRS atau surat keterangan.</p>}

              {method === "otp" ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Gunakan email mahasiswa kampus (berakhiran .ac.id). Email staf/dosen/alumni tidak diterima.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder="nama@student.kampus.ac.id" disabled={Boolean(otpOk)} maxLength={120} />
                    <Button variant="glass" size="pill" className="shrink-0" disabled={busy !== null || Boolean(otpOk) || otpEmail.trim().length < 6} onClick={sendCode}>
                      {busy === "otp-send" ? <Loader2 className="animate-spin" /> : <Mail />} {otpSent ? "Kirim ulang" : "Kirim kode"}
                    </Button>
                  </div>
                  {otpSent && !otpOk && (
                    <div>
                      <p className="mb-2 text-sm text-muted-foreground">Masukkan 6 digit kode dari email Anda.</p>
                      <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} onComplete={(c) => void checkCode(c)} disabled={busy === "otp-check"}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  )}
                  {otpOk && (
                    <p className="flex items-center gap-2 text-sm font-medium text-primary">
                      <BadgeCheck className="h-4 w-4" /> {otpOk} terverifikasi
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    {method === "krs" ? "Unggah KRS semester berjalan yang memuat nama dan NIM Anda." : "Unggah surat keterangan mahasiswa aktif dari kampus (terbaru)."} Pengajuan dengan cara ini selalu diperiksa admin.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-4 text-sm hover:bg-muted">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{supportFile ? supportFile.name : "Pilih berkas"}</span>
                    </span>
                    <span className="shrink-0 font-medium text-primary">Pilih</span>
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && checkFile(f)) setSupportFile(f);
                      }}
                    />
                  </label>
                </div>
              )}
            </Step>

            <div className="glass rounded-3xl border border-border p-6">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" />
                <span>Saya menyatakan data dan dokumen ini benar dan milik saya sendiri. Pemalsuan dapat mengakibatkan verifikasi dicabut.</span>
              </label>
              <Button variant="hero" size="xl" className="mt-5 w-full sm:w-auto" disabled={problem !== null || busy !== null} onClick={send}>
                {busy === "submit" ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Kirim pengajuan
              </Button>
              {problem && <p className="mt-2 text-xs text-muted-foreground">{problem}</p>}
            </div>
          </div>

          <Rules reviewHours={config.reviewHours} retentionDays={config.retentionDays} />
        </div>
      )}

      {!showForm && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="glass rounded-3xl border border-border p-7">
            <p className="text-sm text-muted-foreground">Langkah berikutnya</p>
            <p className="mt-1 font-display text-xl font-semibold">Pilih Premium Mahasiswa</p>
            <Button asChild variant="hero" size="xl" className="mt-5">
              <Link to="/langganan">Lihat paket</Link>
            </Button>
          </div>
          <Rules reviewHours={config.reviewHours} retentionDays={config.retentionDays} />
        </div>
      )}
    </PremiumShell>
  );
}

function StatusBanner({ v, reviewHours }: { v: Awaited<ReturnType<typeof getVerificationState>>["verification"]; reviewHours: number }) {
  if (v.status === "verified")
    return (
      <Banner tone="ok" icon={<BadgeCheck />} title="Terverifikasi sebagai mahasiswa">
        Berlaku sampai {v.expiresAt ? fmtDate(v.expiresAt) : "-"}
        {v.university ? ` · ${v.university}` : ""}
        {v.nimLast4 ? ` · NIM ••••${v.nimLast4}` : ""}.{v.canRenew ? " Masa berlaku hampir habis; Anda bisa memperbarui sekarang." : ""}
      </Banner>
    );
  if (v.status === "pending")
    return (
      <Banner tone="wait" icon={<Clock />} title="Pengajuan sedang diperiksa">
        Admin memeriksa pengajuan Anda (maksimal {reviewHours} jam). Hasilnya muncul di notifikasi.
      </Banner>
    );
  if (v.status === "rejected")
    return (
      <Banner tone="bad" icon={<XCircle />} title="Pengajuan ditolak">
        {v.rejectReason ? `Alasan: ${v.rejectReason}. ` : ""}Anda dapat mengajukan ulang dengan data yang benar.
      </Banner>
    );
  if (v.status === "expired")
    return (
      <Banner tone="bad" icon={<Clock />} title="Masa verifikasi berakhir">
        Perbarui verifikasi untuk kembali mendapat harga mahasiswa.
      </Banner>
    );
  return (
    <Banner tone="wait" icon={<GraduationCap />} title="Belum terverifikasi">
      Selesaikan 3 langkah di bawah untuk mendapat diskon mahasiswa.
    </Banner>
  );
}

function Banner({ tone, icon, title, children }: { tone: "ok" | "wait" | "bad"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-4 rounded-3xl border p-6 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0", tone === "bad" ? "border-destructive/40 bg-destructive/5" : "border-border glass")}>
      <span className={tone === "bad" ? "text-destructive" : "text-primary"}>{icon}</span>
      <div>
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function Step({ n, title, icon, children }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl border border-border p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-primary-foreground">{n}</span>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-primary">
          {icon} {title}
        </h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("block text-sm", wide && "sm:col-span-2")}>
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

function Rules({ reviewHours, retentionDays }: { reviewHours: number; retentionDays: number }) {
  return (
    <aside className="h-fit rounded-3xl border border-border bg-card p-6 text-sm shadow-soft">
      <p className="font-display text-base font-semibold">Aturan verifikasi</p>
      <ul className="mt-3 space-y-2.5 text-muted-foreground">
        <li>
          <strong className="text-foreground">Disetujui otomatis</strong> hanya bila semua ini terpenuhi: OTP email mahasiswa kampus (bukan staf/dosen) benar, NIM belum dipakai akun lain, data KTM cocok dengan yang Anda konfirmasi, dan gambar jelas.
        </li>
        <li>
          <strong className="text-foreground">Selain itu diperiksa admin</strong> (maksimal {reviewHours} jam), termasuk pengajuan lewat KRS, surat keterangan, atau PDF.
        </li>
        <li>Pembacaan teks otomatis hanya membantu mengisi data. Itu bukan bukti keaslian KTM maupun status aktif Anda.</li>
        <li>Satu NIM hanya untuk satu akun. Verifikasi berlaku 1 tahun, lalu perlu diperbarui.</li>
        <li>
          Dokumen disimpan privat, hanya bisa dibuka admin, dan dihapus {retentionDays} hari setelah keputusan. Yang tersisa hanya status dan NIM dalam bentuk terenkripsi (hash).
        </li>
      </ul>
    </aside>
  );
}
