// Small helpers every edge function uses for its responses.
// No Deno imports in here, so the tests can use it from Node too.

// The app runs on phones and in the browser (Expo web), so we allow any origin.
// Every request still needs a valid login token (or the cron secret for daily-streaks).
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// error responses always look like { error: "...", details?: [...] }
export function errorResponse(status: number, error: string, details?: string[]): Response {
  if (details && details.length > 0) {
    return json(status, { error: error, details: details });
  }
  return json(status, { error: error });
}

// browsers send an OPTIONS request first (CORS preflight). we also only allow POST.
// returns a response if we should stop here, otherwise null
export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "use POST");
  }
  return null;
}

// reads the JSON body, or returns null if it isn't valid JSON
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch (_err) {
    return null;
  }
}

// the Authorization header if it looks like a login token, otherwise null
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header;
}
