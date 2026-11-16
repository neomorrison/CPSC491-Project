// Builds the MCP server and registers the six tools.
// The tool logic is in tools.ts. This file is only the descriptions and input shapes
// the assistant sees.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { FitnessData } from "./data.ts";
import {
  createWorkoutPlan,
  getGoals,
  getPlan,
  getProgress,
  getWorkouts,
  updateWorkoutPlan,
  type ToolResult,
} from "./tools.ts";

function reply(result: ToolResult) {
  return { content: [{ type: "text" as const, text: result.text }], isError: result.isError };
}

// one catch for every tool, so a database or network problem becomes a normal tool error
async function run(work: () => Promise<ToolResult>) {
  try {
    return reply(await work());
  } catch (err) {
    console.error("tool failed: " + String(err));
    return reply({ text: "Something went wrong reaching the fitness app. Try again later.", isError: true });
  }
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

const planShape = {
  weekStart: date.describe("The Monday the plan starts on, YYYY-MM-DD. This week or one of the next 4 weeks."),
  note: z.string().max(500).optional().describe("A short explanation of the plan for the user. No medical advice."),
  items: z
    .array(
      z.object({
        day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        workoutType: z.enum(["strength", "cardio", "yoga", "sports", "other"]),
        minutes: z.number().int().describe("Session length, 10 to 120 minutes"),
        details: z.string().max(300).optional().describe("What to do in the session"),
      }),
    )
    .describe("One item per workout day, at most one per day. Leave at least one rest day."),
};

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
const SUGGEST = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export function createServer(data: FitnessData): McpServer {
  const server = new McpServer({ name: "fitness-monitor", version: "0.1.0" });

  server.registerTool(
    "get_workouts",
    {
      title: "Get workouts",
      description:
        "Read the user's logged workouts with their exercises. Optional from and to dates (YYYY-MM-DD). " +
        "Without dates it returns the last 30 days.",
      inputSchema: { from: date.optional(), to: date.optional() },
      annotations: READ_ONLY,
    },
    (args) => run(() => getWorkouts(data, args)),
  );

  server.registerTool(
    "get_goals",
    {
      title: "Get goals",
      description:
        "Read the user's fitness goal, planned workout days, preferred time, usual session length, " +
        "experience level, and today's date in their time zone.",
      annotations: READ_ONLY,
    },
    () => run(() => getGoals(data)),
  );

  server.registerTool(
    "get_progress",
    {
      title: "Get progress",
      description: "Read the user's level, total XP, current and best streak, streak freezes left, and badges.",
      annotations: READ_ONLY,
    },
    () => run(() => getProgress(data)),
  );

  server.registerTool(
    "get_plan",
    {
      title: "Get workout plans",
      description:
        "Read the user's workout plans with their items. Optional weekStart (a Monday, YYYY-MM-DD). " +
        "Without it, returns the newest plans. A plan's status is suggested, active, archived, or dismissed.",
      inputSchema: { weekStart: date.optional() },
      annotations: READ_ONLY,
    },
    (args) => run(() => getPlan(data, args)),
  );

  server.registerTool(
    "create_workout_plan",
    {
      title: "Suggest a workout plan",
      description:
        "Save a weekly workout plan as a suggestion. It does not become active: the user accepts or " +
        "dismisses it in the app. General exercise guidance only, never medical advice. " +
        "The app rejects unsafe plans and says why, so you can fix the plan and try again.",
      inputSchema: planShape,
      annotations: SUGGEST,
    },
    (args) => run(() => createWorkoutPlan(data, args)),
  );

  server.registerTool(
    "update_workout_plan",
    {
      title: "Change a suggested workout plan",
      description:
        "Replace a plan you suggested before, while it is still a suggestion. Send the whole plan again " +
        "with its planId. If the user already accepted or dismissed it, create a new plan instead.",
      inputSchema: {
        planId: z.string().uuid().describe("The planId that create_workout_plan returned"),
        ...planShape,
      },
      annotations: SUGGEST,
    },
    (args) => run(() => updateWorkoutPlan(data, args)),
  );

  return server;
}
