# MCP Server

Connects a user's AI assistant (like Claude or ChatGPT) to the app through the Model Context
Protocol. The assistant can read the user's fitness data and suggest workout plans. Owner: Vats.

The app works fully without this. It is optional and the user has to turn it on.

## Tools

**Read tools** (need "let my assistant read my data", `profiles.ai_can_read`)

| Tool | What it returns |
|---|---|
| `get_workouts` | Logged workouts with their exercises. Optional `from` and `to` dates, otherwise the last 30 days |
| `get_goals` | Goal, planned days, preferred time, session length, experience level, today's date |
| `get_progress` | Level, total XP, current and best streak, freezes left, badges |
| `get_plan` | Workout plans with their items. Optional `weekStart`, otherwise the newest plans |

**Plan tools** (need "Suggest workout plans", `profiles.ai_can_create_plans`)

| Tool | What it does |
|---|---|
| `create_workout_plan` | Saves a weekly plan as a **suggestion** |
| `update_workout_plan` | Replaces a plan it suggested before, while it is still a suggestion |

Both plan tools call the backend's `save-plan` function, which checks the permission and runs
the safety checks. The server turns its answers into messages the assistant can act on:

| save-plan answers | What the assistant is told |
|---|---|
| 200 | Saved as a suggestion. The user accepts or dismisses it in the app |
| 403 | The user hasn't turned on "Suggest workout plans". Ask them to enable it |
| 422 | Why the plan failed the safety checks, so it can fix the plan and try again |
| 404 | That plan was already accepted or dismissed. Create a new one instead |
| 429 | It suggested too many new plans this week. Update a suggested plan instead, or wait |
| 401 | The sign-in is wrong or expired |

## Rules

- There is no tool that logs workouts, gives XP, changes streaks, or deletes anything.
- Reading and creating plans are separate permissions. Each one is off until the user turns it on.
- The server signs in as the user with their own app email and password, so the database
  security rules still apply. There is no service role key in this project.
- The read permission is checked by this server before every read tool. The plan permission
  is checked by `save-plan`.

## Setup

You need Node 20.12 or newer.

```
cd mcp-server
npm install
cp .env.example .env    # then fill in the four values
```

| Setting | What it is |
|---|---|
| `SUPABASE_URL` | The Supabase project URL |
| `SUPABASE_ANON_KEY` | The project's anon (publishable) key |
| `FITNESS_EMAIL` | The app account to sign in as |
| `FITNESS_PASSWORD` | That account's password |

The password stays in `.env` on the user's own computer. The assistant never sees it.

## Tests

```
npm test            # unit tests, no database needed
npm run typecheck
```

`tests/server.test.ts` runs the real MCP server in memory with a real MCP client and fake data,
so it checks what an assistant actually sees.

To test against a real local database, start local Supabase and serve the backend functions
(see `backend/README.md`), then:

```
npx tsx scripts/smoke-test.ts <API_URL> <ANON_KEY>
```

## Connecting an assistant

The server talks over stdio, so the assistant app starts it. For Claude Desktop, add this to
`claude_desktop_config.json` (use the full path to this folder):

```json
{
  "mcpServers": {
    "fitness-monitor": {
      "command": "npx",
      "args": ["tsx", "/full/path/to/CPSC491-Project/mcp-server/src/index.ts"]
    }
  }
}
```

## Files

```
src/index.ts      starts the server over stdio
src/server.ts     registers the six tools (names, descriptions, input shapes)
src/tools.ts      what each tool does. No MCP or database code, so it is easy to test
src/supabase.ts   signs in and reads the data
src/data.ts       the types shared by the files above
```

Diagrams: [architecture](../docs/diagrams/1-architecture.png), [assistant creates a plan](../docs/diagrams/5-assistant-plan-sequence.png)
