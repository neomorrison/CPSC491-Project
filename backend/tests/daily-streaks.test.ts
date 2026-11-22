import { describe, expect, it } from "vitest";
import { handleDailyStreaks, type DailyStreaksDeps, type StreakUser } from "../supabase/functions/daily-streaks/handler.ts";
import type { StreakResult } from "../supabase/functions/_shared/gamification/index.ts";

function user(changes: Partial<StreakUser> = {}): StreakUser {
  return {
    userId: "user-1",
    timeZone: "America/Los_Angeles",
    plannedDays: ["mon", "wed", "fri"],
    bestStreak: 0,
    lastChecked: null,
    ...changes,
  };
}

function makeDeps(users: StreakUser[], dates: Record<string, string[]>, changes: Partial<DailyStreaksDeps> = {}) {
  const saves: { userId: string; streak: StreakResult; checkedOn: string }[] = [];
  const deps: DailyStreaksDeps = {
    cronSecret: "s3cret",
    listUsers: async () => users,
    getWorkoutDates: async (userId) => dates[userId] ?? [],
    saveStreak: async (userId, streak, checkedOn) => {
      saves.push({ userId, streak, checkedOn });
      return true;
    },
    now: () => new Date("2026-11-05T20:00:00Z"), // Thursday Nov 5, noon in Los Angeles
    ...changes,
  };
  return { deps, saves };
}

function call(secret: string | null = "s3cret", method = "POST") {
  const headers: Record<string, string> = {};
  if (secret !== null) headers["x-cron-secret"] = secret;
  return new Request("http://localhost/daily-streaks", { method: method, headers: headers });
}

describe("daily-streaks", () => {
  it("rejects a missing or wrong secret", async () => {
    const { deps, saves } = makeDeps([user()], {});
    expect((await handleDailyStreaks(call(null), deps)).status).toBe(401);
    expect((await handleDailyStreaks(call("nope"), deps)).status).toBe(401);
    expect(saves.length).toBe(0);
  });

  it("refuses to run if the secret was never set", async () => {
    const empty = makeDeps([user()], {}, { cronSecret: "" });
    expect((await handleDailyStreaks(call(""), empty.deps)).status).toBe(401);
    const placeholder = makeDeps([user()], {}, { cronSecret: "change-me" });
    expect((await handleDailyStreaks(call("change-me"), placeholder.deps)).status).toBe(401);
  });

  it("only accepts POST", async () => {
    const { deps } = makeDeps([], {});
    expect((await handleDailyStreaks(call("s3cret", "GET"), deps)).status).toBe(405);
  });

  it("keeps a streak going across a rest day", async () => {
    // Mon and Wed done, Tue was a rest day, today is Thu (also a rest day)
    const { deps, saves } = makeDeps([user()], { "user-1": ["2026-11-02", "2026-11-04"] });
    const res = await handleDailyStreaks(call(), deps);
    expect(await res.json()).toEqual({ checked: 1, skipped: 0, failed: 0 });
    expect(saves[0].streak.current).toBe(2);
    expect(saves[0].checkedOn).toBe("2026-11-05");
  });

  it("uses a freeze when a planned day was missed and not made up", async () => {
    // Mon done, Wed missed, nothing on Thu yet. checked on Fri, so the grace day is over.
    const { deps, saves } = makeDeps([user()], { "user-1": ["2026-11-02"] }, { now: () => new Date("2026-11-06T20:00:00Z") });
    await handleDailyStreaks(call(), deps);
    expect(saves[0].streak.current).toBe(1);
    expect(saves[0].streak.freezesLeft).toBe(0);
  });

  it("skips users already checked today", async () => {
    const { deps, saves } = makeDeps([user({ lastChecked: "2026-11-05" })], {});
    const res = await handleDailyStreaks(call(), deps);
    expect(await res.json()).toEqual({ checked: 0, skipped: 1, failed: 0 });
    expect(saves.length).toBe(0);
  });

  it("uses each user's own time zone for today", async () => {
    // 2026-11-05 07:00 UTC is Nov 4 in Los Angeles and Nov 5 in Tokyo
    const users = [user({ userId: "la" }), user({ userId: "tokyo", timeZone: "Asia/Tokyo" })];
    const { deps, saves } = makeDeps(users, {}, { now: () => new Date("2026-11-05T07:00:00Z") });
    await handleDailyStreaks(call(), deps);
    expect(saves.find((s) => s.userId === "la")?.checkedOn).toBe("2026-11-04");
    expect(saves.find((s) => s.userId === "tokyo")?.checkedOn).toBe("2026-11-05");
  });

  it("never lowers the best streak", async () => {
    const { deps, saves } = makeDeps([user({ bestStreak: 9 })], { "user-1": ["2026-11-04"] });
    await handleDailyStreaks(call(), deps);
    expect(saves[0].streak.best).toBe(9);
  });

  it("keeps going when one user fails", async () => {
    const users = [user({ userId: "bad", timeZone: "Not/AZone" }), user({ userId: "good" })];
    const { deps, saves } = makeDeps(users, {});
    const res = await handleDailyStreaks(call(), deps);
    expect(await res.json()).toEqual({ checked: 1, skipped: 0, failed: 1 });
    expect(saves[0].userId).toBe("good");
  });

  it("counts a failed save", async () => {
    const { deps } = makeDeps([user()], {}, { saveStreak: async () => false });
    const res = await handleDailyStreaks(call(), deps);
    expect(await res.json()).toEqual({ checked: 0, skipped: 0, failed: 1 });
  });

  it("expires finished challenges every run, even when everyone was skipped", async () => {
    let calls = 0;
    const { deps } = makeDeps([user({ lastChecked: "2026-11-05" })], {}, {
      expireChallenges: async () => {
        calls++;
        return 3;
      },
    });
    const res = await handleDailyStreaks(call(), deps);
    expect(await res.json()).toEqual({ checked: 0, skipped: 1, failed: 0, expiredChallenges: 3 });
    expect(calls).toBe(1);
  });

  it("still answers 200 if expiring challenges fails", async () => {
    const { deps } = makeDeps([], {}, { expireChallenges: async () => Promise.reject(new Error("boom")) });
    const res = await handleDailyStreaks(call(), deps);
    expect(res.status).toBe(200);
    expect((await res.json()).expiredChallenges).toBe(0);
  });
});
