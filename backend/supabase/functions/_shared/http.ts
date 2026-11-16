// Small helpers every edge function uses for its responses.
// No Deno imports in here, so the tests can use it from Node too.

// The app runs on phones and in the browser (Expo web), so we allow any origin.
// Every request still needs a valid login token.
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// reads the JSON body, or returns null if it isn't valid JSON
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch (_err) {
    return null;
  }
}
