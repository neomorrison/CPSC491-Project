// Runs the real MCP server in memory with a real MCP client, using fake data.
// This checks what an assistant actually sees: the tool list and the tool answers.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import type { FitnessData } from "../src/data.ts";
import { createServer } from "../src/server.ts";
import { readSettings } from "../src/supabase.ts";
import { fakeData } from "./fake.ts";

async function connectClient(data: FitnessData) {
  const server = createServer(data);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

// the SDK types the content loosely, so read the first text block
function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content[0].text;
}

describe("MCP server", () => {
  it("offers exactly the seven tools from the README", async () => {
    const client = await connectClient(fakeData());
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "create_workout_plan",
      "get_goals",
      "get_plan",
      "get_progress",
      "get_weekly_summary",
      "get_workouts",
      "update_workout_plan",
    ]);
  });

  it("has no tool that logs workouts, gives XP, changes streaks, or deletes", async () => {
    const client = await connectClient(fakeData());
    const tools = (await client.listTools()).tools;
    for (const t of tools) {
      expect(t.name).not.toMatch(/log|delete|remove|xp|streak/);
    }
  });

  it("marks the five read tools read-only and the plan tools not", async () => {
    const client = await connectClient(fakeData());
    const tools = (await client.listTools()).tools;
    for (const t of tools) {
      const readOnly = t.annotations?.readOnlyHint;
      expect(readOnly).toBe(t.name.startsWith("get_"));
    }
  });

  it("accepts the newer workout types in a plan", async () => {
    const data = fakeData();
    const client = await connectClient(data);
    const result = await client.callTool({
      name: "create_workout_plan",
      arguments: { weekStart: "2026-11-09", items: [{ day: "sat", workoutType: "hiking", minutes: 60 }] },
    });
    expect(result.isError).toBeFalsy();
    expect(data.calls.saved.length).toBe(1);
  });

  it("answers get_weekly_summary", async () => {
    const client = await connectClient(fakeData());
    const result = await client.callTool({ name: "get_weekly_summary", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result)).streak.current).toBe(4);
  });

  it("offers the weekly review prompt, which asks for feedback and forbids medical advice", async () => {
    const client = await connectClient(fakeData());
    const prompts = (await client.listPrompts()).prompts.map((p) => p.name);
    expect(prompts).toEqual(["weekly_review"]);

    const prompt = await client.getPrompt({ name: "weekly_review" });
    const text = (prompt.messages[0].content as { text: string }).text;
    expect(text).toMatch(/get_weekly_summary/);
    expect(text).toMatch(/feedback/i);
    expect(text).toMatch(/No medical advice/);
  });

  it("answers a read tool call", async () => {
    const client = await connectClient(fakeData());
    const result = await client.callTool({ name: "get_progress", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result)).level).toBe(3);
  });

  it("saves a plan through create_workout_plan", async () => {
    const data = fakeData();
    const client = await connectClient(data);
    const result = await client.callTool({
      name: "create_workout_plan",
      arguments: { weekStart: "2026-11-09", items: [{ day: "mon", workoutType: "cardio", minutes: 30 }] },
    });
    expect(result.isError).toBeFalsy();
    expect(data.calls.saved.length).toBe(1);
  });

  it("rejects input that doesn't match the tool's shape before calling the backend", async () => {
    const data = fakeData();
    const client = await connectClient(data);
    const result = await client
      .callTool({
        name: "create_workout_plan",
        arguments: { weekStart: "next monday", items: [{ day: "funday", workoutType: "cardio", minutes: 30 }] },
      })
      .catch((err) => ({ isError: true, content: [{ type: "text", text: String(err) }] }));
    expect(result.isError).toBe(true);
    expect(data.calls.saved.length).toBe(0);
  });

  it("turns a crash in the data layer into a normal tool error", async () => {
    const data = fakeData({
      getProfile: async () => {
        throw new Error("database is down: secret-host-name");
      },
    });
    const client = await connectClient(data);
    const result = await client.callTool({ name: "get_goals", arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).not.toMatch(/secret-host-name/);
  });
});

describe("settings", () => {
  it("lists everything that is missing", () => {
    expect(() => readSettings({ SUPABASE_URL: "http://x" })).toThrow(/SUPABASE_ANON_KEY, FITNESS_EMAIL, FITNESS_PASSWORD/);
  });

  it("reads complete settings", () => {
    const s = readSettings({ SUPABASE_URL: "http://x", SUPABASE_ANON_KEY: "k", FITNESS_EMAIL: "a@b.c", FITNESS_PASSWORD: "p" });
    expect(s).toEqual({ url: "http://x", anonKey: "k", email: "a@b.c", password: "p" });
  });
});
