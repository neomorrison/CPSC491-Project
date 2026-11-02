# MCP Server

Connects a user's AI assistant (like Claude or ChatGPT) to the app through the Model Context Protocol. Owner: Vats.

Not started yet. The plan:

**Read tools** (so the assistant can give advice)
- `get_workouts`, `get_goals`, `get_progress`, `get_plan`

**Plan tools** (so the assistant can create stuff in the app)
- `create_workout_plan`, `update_workout_plan`
- These go through the backend's `save-plan` function, which runs safety checks (safe session lengths, rest days, no medical claims) and rejects bad plans with a reason the assistant can fix
- Plans are saved as **suggested**. The user accepts, edits, or dismisses them in the app.

**Logic Rules**
- Only works after the user connects it, and only sees the data types they allow
- Reading and creating plans are separate permissions
- The assistant can't log workouts, give XP, change streaks, or delete anything
- Uses the user's own login, so the database security rules still apply

Diagrams: [architecture](../docs/diagrams/1-architecture.png), [assistant creates a plan](../docs/diagrams/5-assistant-plan-sequence.png)
