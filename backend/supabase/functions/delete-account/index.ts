// POST /functions/v1/delete-account
// Deletes the signed-in user's account. All our tables use "on delete cascade" back to the
// user, so their workouts, XP, plans, settings, etc. all get deleted too.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { adminClient, json, preflight, requireUser } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const stop = preflight(req);
  if (stop) return stop;

  const user = await requireUser(req);
  if (user instanceof Response) return user;

  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("delete-account failed", error);
    return json(500, { error: "couldn't delete the account, try again" });
  }
  return json(200, { deleted: true });
});
