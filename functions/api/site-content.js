// Cloudflare Pages Function: serves the site-data JSON payload stored in the
// site-content KV namespace under the "site-data" key. The frontend fetches
// this from /api/site-content instead of json/site-data.json.
//
// NOTE: KV binding names in Cloudflare Pages Functions are case-sensitive.
// The namespace is bound as "site-content" (lowercase) — using the wrong
// casing causes context.env.<NAME> to be undefined and KV.get() to throw.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
};

// Binding name as configured on the Cloudflare Pages project (lowercase).
const KV_BINDING = "site-content";
const KV_KEY = "site-data";

export async function onRequest(context) {
  // Handle CORS preflight cheaply.
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const binding = context.env[KV_BINDING];
  if (!binding) {
    return new Response(
      JSON.stringify({
        error: `KV binding "${KV_BINDING}" is not configured on this Pages project. Check Settings → Functions → KV namespace bindings.`,
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let data;
  try {
    data = await binding.get(KV_KEY);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "KV read failed", detail: String(err) }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (data === null || data === undefined) {
    return new Response(
      JSON.stringify({ error: `Key "${KV_KEY}" not found in ${KV_BINDING}` }),
      { status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  return new Response(data, {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}