export async function onRequest(context) {
  // 1. Fetch the data from KV using the "SITE_CONTENT" binding name we created in Step 1
  // and look for the key named "site-data" (the one you pasted your JSON into).
  const data = await context.env.SITE_CONTENT.get("site-data");

  // 2. Send the JSON text straight to the browser
  return new Response(data, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*" // Allows your frontend to read it securely
    }
  });
}