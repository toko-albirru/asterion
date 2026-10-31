const H = { "content-type": "application/json", "cache-control": "no-store" };

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function authed(req, env) {
  const pw = req.headers.get("x-admin-password") || "";
  if (!env.ADMIN_PASSWORD || !pw) return false;
  return (await sha(pw)) === (await sha(env.ADMIN_PASSWORD));
}

function valid(d) {
  if (!Array.isArray(d) || d.length > 100) return false;
  return d.every(
    (s) =>
      s && typeof s.t === "string" && s.t.length <= 120 && Array.isArray(s.l) && s.l.length <= 300 &&
      s.l.every((k) => k && typeof k.n === "string" && k.n.length <= 200 && typeof k.u === "string" && /^https?:\/\//i.test(k.u) && k.u.length <= 2000)
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/links") return env.ASSETS.fetch(request);

    if (request.method === "GET") {
      const v = await env.LINKS.get("data");
      return new Response(v || "null", { headers: H });
    }
    if (request.method === "POST") {
      return new Response(null, { status: (await authed(request, env)) ? 200 : 401 });
    }
    if (request.method === "PUT") {
      if (!(await authed(request, env))) return new Response(null, { status: 401 });
      let body;
      try { body = await request.json(); } catch { return new Response(null, { status: 400 }); }
      if (!valid(body)) return new Response(null, { status: 400 });
      await env.LINKS.put("data", JSON.stringify(body));
      return new Response("{}", { headers: H });
    }
    return new Response(null, { status: 405 });
  },
};
