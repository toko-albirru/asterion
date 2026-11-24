// @ts-nocheck — penjalur test kustom; tipe longgar disengaja
// Supabase palsu di memori untuk test premium.server.ts: query builder, constraint unik (23505),
// trigger satu-langganan-aktif, urutan kode unik, dan salinan JS dari fungsi SQL klaim kupon.
export type Row = Record<string, any>;
type Err = { code: string; message: string } | null;

const TABLES = ["payments", "licenses", "institution_coupons", "coupon_redemptions", "student_verifications", "notifications", "email_otps", "student_domain_rules"];

export function createFakeSupabase() {
  const tables: Record<string, Row[]> = Object.fromEntries(TABLES.map((t) => [t, []]));
  const users = new Map<string, { email: string; confirmed: boolean }>();
  const state = { seq: 0 };
  const now = () => new Date().toISOString();

  const uniq: Record<string, { name: string; hit: (a: Row, b: Row) => boolean }[]> = {
    payments: [
      { name: "payments_order_id_key", hit: (a, b) => a["order_id"] === b["order_id"] },
      { name: "payments_one_pending_per_user", hit: (a, b) => a["status"] === "pending" && b["status"] === "pending" && a["user_id"] === b["user_id"] },
      { name: "payments_qris_pending_amount", hit: (a, b) => a["provider"] === "qris" && b["provider"] === "qris" && a["status"] === "pending" && b["status"] === "pending" && a["amount_idr"] === b["amount_idr"] },
    ],
    licenses: [{ name: "licenses_token_key", hit: (a, b) => a.token === b.token }],
    institution_coupons: [{ name: "institution_coupons_code_key", hit: (a, b) => a.code === b.code }],
    student_verifications: [{ name: "student_verifications_nim_verified", hit: (a, b) => a.status === "verified" && b.status === "verified" && a.nim_hash != null && a.nim_hash === b.nim_hash }],
    coupon_redemptions: [
      { name: "coupon_redemptions_order_id_key", hit: (a, b) => a.order_id === b.order_id },
      { name: "coupon_redemptions_one_active_per_user", hit: (a, b) => a.coupon_id === b.coupon_id && a.user_id === b.user_id && ["reserved", "redeemed"].includes(a.status) && ["reserved", "redeemed"].includes(b.status) },
    ],
  };
  const defaults: Record<string, () => Row> = {
    payments: () => ({ status: "pending", discount_idr: 0, kind: "individual", claimed_at: null, paid_at: null, settled_at: null, license_id: null, reject_reason: null, confirmed_by: null, confirmed_at: null }),
    licenses: () => ({ source: "payment", coupon_id: null, cancelled_at: null, device_id: null }),
    institution_coupons: () => ({ status: "pending", paid_at: null, exhausted_at: null, email_domains: [] }),
    notifications: () => ({ read_at: null }),
  };

  function violation(table: string, row: Row, ignore?: Row): Err {
    for (const u of uniq[table] ?? []) {
      if (tables[table]!.some((e) => e !== ignore && u.hit(e, row))) return { code: "23505", message: `duplicate key value violates unique constraint "${u.name}"` };
    }
    if (table === "licenses" && tables["licenses"]!.some((l) => l.user_id === row.user_id && l.expires_at > now() && l.plan !== row.plan)) {
      return { code: "P0001", message: "plan_conflict" };
    }
    return null;
  }

  function from(table: string) {
    let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    let conflictCol = "";
    let payload: Row = {};
    let returning = false;
    const filters: ((r: Row) => boolean)[] = [];
    let orderKey: string | null = null;
    let asc = true;
    let lim = Infinity;
    let mode: "many" | "single" | "maybe" = "many";

    const exec = (): { data: any; error: Err } => {
      const rows = tables[table]!;
      let out: Row[] = [];
      if (op === "upsert") {
        const hit = rows.find((r) => r[conflictCol] === payload[conflictCol]);
        if (hit) {
          const err = violation(table, { ...hit, ...payload }, hit);
          if (err) return { data: null, error: err };
          Object.assign(hit, payload);
          out = [hit];
        } else {
          const row: Row = { id: crypto.randomUUID(), created_at: now(), ...(defaults[table]?.() ?? {}), ...payload };
          const err = violation(table, row);
          if (err) return { data: null, error: err };
          rows.push(row);
          out = [row];
        }
      } else if (op === "insert") {
        const row: Row = { id: crypto.randomUUID(), created_at: now(), ...(defaults[table]?.() ?? {}), ...payload };
        const err = violation(table, row);
        if (err) return { data: null, error: err };
        rows.push(row);
        out = [row];
      } else {
        let matched = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") {
          for (const r of matched) {
            const next = { ...r, ...payload };
            const err = violation(table, next, r);
            if (err) return { data: null, error: err };
            Object.assign(r, payload);
          }
        } else if (op === "delete") {
          tables[table] = rows.filter((r) => !matched.includes(r));
        }
        if (orderKey) matched = [...matched].sort((a, b) => (a[orderKey!] < b[orderKey!] ? -1 : a[orderKey!] > b[orderKey!] ? 1 : 0) * (asc ? 1 : -1));
        out = matched.slice(0, lim);
      }
      if ((op === "insert" || op === "update" || op === "delete" || op === "upsert") && !returning) return { data: null, error: null };
      const copy = out.map((r) => structuredClone(r));
      if (mode === "single") return copy.length === 1 ? { data: copy[0], error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } };
      if (mode === "maybe") return { data: copy[0] ?? null, error: null };
      return { data: copy, error: null };
    };

    const q: any = {
      select() { if (op !== "select") returning = true; return q; },
      insert(p: Row) { op = "insert"; payload = p; return q; },
      update(p: Row) { op = "update"; payload = p; return q; },
      upsert(p: Row, o?: { onConflict?: string }) { op = "upsert"; payload = p; conflictCol = o?.onConflict ?? "id"; return q; },
      delete() { op = "delete"; return q; },
      eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return q; },
      neq(c: string, v: unknown) { filters.push((r) => r[c] !== v); return q; },
      in(c: string, v: unknown[]) { filters.push((r) => v.includes(r[c])); return q; },
      is(c: string, v: unknown) { filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return q; },
      not(c: string, o: string, v: unknown) { if (o !== "is") throw new Error("fake: not() hanya mendukung 'is'"); filters.push((r) => (v === null ? r[c] != null : r[c] !== v)); return q; },
      gt(c: string, v: any) { filters.push((r) => r[c] > v); return q; },
      gte(c: string, v: any) { filters.push((r) => r[c] >= v); return q; },
      lt(c: string, v: any) { filters.push((r) => r[c] < v); return q; },
      order(c: string, o?: { ascending?: boolean }) { orderKey = c; asc = o?.ascending !== false; return q; },
      limit(n: number) { lim = n; return q; },
      single() { mode = "single"; return q; },
      maybeSingle() { mode = "maybe"; return q; },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { try { return Promise.resolve(exec()).then(res, rej); } catch (e) { return Promise.reject(e); } },
    };
    return q;
  }

  async function rpc(name: string, args: Row = {}): Promise<{ data: any; error: Err }> {
    if (name === "expire_stale_qris") {
      let n = 0;
      for (const p of tables["payments"]!) {
        if (p.provider === "qris" && p.status === "pending" && !p.claimed_at && p.expires_at && p.expires_at < now()) { p.status = "expired"; n++; }
      }
      return { data: n, error: null };
    }
    if (name === "expire_student_verifications") {
      let n = 0;
      for (const v of tables["student_verifications"]!) if (v.status === "verified" && v.expires_at && v.expires_at <= now()) { v.status = "expired"; n++; }
      return { data: n, error: null };
    }
    if (name === "next_qris_code") {
      await rpc("expire_stale_qris");
      for (let i = 0; i < 999; i++) {
        state.seq = (state.seq % 999) + 1; // 1..999 lalu kembali ke 1 (CYCLE)
        const total = args["p_base"] + state.seq;
        if (!tables["payments"]!.some((p) => p.provider === "qris" && p.status === "pending" && p.amount_idr === total)) return { data: state.seq, error: null };
      }
      return { data: null, error: { code: "P0001", message: "qris_codes_exhausted" } };
    }
    if (name === "claim_institution_coupon") return claimCoupon(args);
    throw new Error(`fake: rpc ${name} tidak dikenal`);
  }

  // Salinan JS dari public.claim_institution_coupon (SQL tidak bisa dijalankan di sini).
  function claimCoupon(a: Row): { data: any; error: Err } {
    const fail = (m: string) => ({ data: null, error: { code: "P0001", message: m } as Err });
    const c = tables["institution_coupons"]!.find((x) => x.code === String(a["p_code"]).trim().toUpperCase());
    if (!c || c.status !== "active") return fail("coupon_invalid");
    if (c.valid_until <= now()) return fail("coupon_expired");
    const dom = String(a["p_email"]).split("@")[1]?.toLowerCase();
    if (c.email_domains.length > 0 && !c.email_domains.includes(dom)) return fail("domain_not_allowed");
    if (tables["licenses"]!.some((l) => l.user_id === a["p_user"] && l.plan === "institution" && l.expires_at > now())) return fail("already_institution");
    const used = tables["coupon_redemptions"]!.filter((r) => r.coupon_id === c.id && r.status === "redeemed").length;
    if (used >= c.seats) return fail("quota_full");
    const lic: Row = { id: crypto.randomUUID(), created_at: now(), ...defaults["licenses"]!(), user_id: a["p_user"], token: a["p_token"], plan: "institution", price_idr: 0, payment_status: "institution", starts_at: now(), expires_at: c.valid_until, source: "institution", coupon_id: c.id };
    const err = violation("licenses", lic);
    if (err) return { data: null, error: err };
    tables["licenses"]!.push(lic);
    const red: Row = { id: crypto.randomUUID(), coupon_id: c.id, user_id: a["p_user"], email: a["p_email"], order_id: "CLAIM-" + crypto.randomUUID(), status: "redeemed", expires_at: c.valid_until, license_id: lic.id };
    const err2 = violation("coupon_redemptions", red);
    if (err2) return { data: null, error: err2 };
    tables["coupon_redemptions"]!.push(red);
    return { data: [{ out_license_id: lic.id, out_expires_at: c.valid_until, out_institution: c.institution_name }], error: null };
  }

  const files = new Set<string>();
  const storage = {
    from: (_bucket: string) => ({
      async createSignedUploadUrl(path: string) { return { data: { signedUrl: "https://signed/" + path, token: "tok-" + path, path }, error: null }; },
      async list(prefix: string) { return { data: [...files].filter((f) => f.startsWith(prefix + "/")).map((f) => ({ name: f.slice(prefix.length + 1) })), error: null }; },
      async remove(paths: string[]) { for (const p of paths) files.delete(p); return { data: paths, error: null }; },
      async createSignedUrl(path: string) { return { data: { signedUrl: "https://signed/" + path + "?t=1" }, error: null }; },
    }),
  };

  const client = {
    from,
    rpc,
    storage,
    auth: {
      admin: {
        async getUserById(id: string) {
          const u = users.get(id);
          return u ? { data: { user: { id, email: u.email, email_confirmed_at: u.confirmed ? now() : null } }, error: null } : { data: { user: null }, error: { message: "tidak ada" } };
        },
      },
    },
  };

  return {
    client,
    tables,
    users,
    files,
    state,
    reset() {
      files.clear();
      for (const t of TABLES) tables[t] = [];
      users.clear();
      state.seq = 0;
    },
  };
}

export const fake = createFakeSupabase();
