import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRO_PRICE_IDR, generateToken, nextPeriod } from "@/lib/license";

/**
 * Issues a new 30-day Pro token for the signed-in user.
 * Hanya aktif saat PAYMENT_MODE=promo (gratis). Mode lain lewat pembayaran (payment.functions.ts).
 */
export const issueProToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getPaymentMode } = await import("@/lib/payment.server");
    if (getPaymentMode() !== "promo") throw new Error("Token Pro sekarang diperoleh lewat pembayaran QRIS.");
    const now = new Date();

    const { data: latest, error: readError } = await supabase
      .from("licenses")
      .select("expires_at")
      .eq("user_id", userId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw new Error("Gagal membaca token Anda.");

    const latestExpiry = latest ? new Date(latest.expires_at) : null;
    const { startsAt, expiresAt } = nextPeriod(latestExpiry, now);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (let attempt = 0; attempt < 3; attempt++) {
      const token = generateToken();
      const { data, error } = await supabaseAdmin
        .from("licenses")
        .insert({
          user_id: userId,
          token,
          plan: "individual",
          price_idr: PRO_PRICE_IDR,
          payment_status: "promo",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .select("token, expires_at")
        .single();
      if (!error) return data;
      if (error.code !== "23505") throw new Error("Gagal membuat token.");
    }
    throw new Error("Gagal membuat token. Coba lagi.");
  });
