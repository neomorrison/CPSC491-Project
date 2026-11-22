// POST /functions/v1/delete-account
// Deletes the signed-in user's account. All our tables use "on delete cascade" back to the
// user, so their workouts, XP, plans, settings, etc. all get deleted too.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { bearerToken, errorResponse, json, preflight } from "../_shared/http.ts";
import { adminClient, userIdFromToken } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;

  const authHeader = bearerToken(req);
  const userId = authHeader ? await userIdFromToken(authHeader) : null;
  if (!userId) {
    return errorResponse(401, "not signed in");
  }

  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error("delete-account failed", error);
    return errorResponse(500, "couldn't delete the account, try again");
  }
  return json(200, { deleted: true });
});
