// Builds the MCP server and registers the seven tools and the weekly review prompt.
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
  getWeeklySummary,
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

// the same list the app and the save-plan function use
const WORKOUT_TYPES = [
  "strength",
  "cardio",
  "walking",
  "yoga",
  "pilates",
  "mobility",
  "hiking",
  "swimming",
  "climbing",
  "sports",
  "other",
] as const;

const planShape = {
  weekStart: date.describe("The Monday the plan starts on, YYYY-MM-DD. This week or one of the next 4 weeks."),
  note: z.string().max(500).optional().describe("A short explanation of the plan for the user. No medical advice."),
  items: z
    .array(
      z.object({
        day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
        workoutType: z.enum(WORKOUT_TYPES),
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
    "get_weekly_summary",
    {
      title: "Get weekly summary",
      description:
        "Read the numbers for feedback on the user's week: workouts, minutes and active days this week and " +
        "last week, which planned days were done, missed or still to come, streak, level, goal progress, and " +
        "how far along this week's plan is. Use it before giving feedback or suggesting next week's plan.",
      annotations: READ_ONLY,
    },
    () => run(() => getWeeklySummary(data)),
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

  // A ready-made request the user can pick in their assistant app: feedback on the week,
  // then a plan for next week. It only tells the assistant how to use the tools above.
  server.registerPrompt(
    "weekly_review",
    {
      title: "Weekly review",
      description: "Feedback on this week's workouts, then a suggested plan for next week.",
    },
    () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text: WEEKLY_REVIEW } }],
    }),
  );

  return server;
}

const WEEKLY_REVIEW = [
  "Give me feedback on my week of workouts, then suggest a plan for next week.",
  "",
  "1. Call get_weekly_summary and get_goals. Call get_workouts if you need the details of a workout.",
  "2. Feedback first, in a few short sentences: what I did (use the real numbers), how it compares with",
  "   last week and with my planned days, and how my goals and streak are going. Say what went well before",
  "   what to change. If the week isn't over, say so and don't count the days still to come as missed.",
  "3. Then suggest next week's plan with create_workout_plan. Base it on what I actually did, not on an ideal",
  "   week: if I missed days, make it easier before making it harder. Put a one or two sentence reason in the note.",
  "4. General exercise guidance only. No medical advice, diagnoses, or injury treatment. If I mention pain or",
  "   an injury, tell me to see a professional and don't plan around it.",
  "5. If a tool says I haven't turned a permission on, tell me which switch to turn on in the app and stop.",
].join("\n");
