# Personal Fitness Monitor

Our CPSC 491 capstone project.

Team: Gala Ferdaous, Stav (Vats) Sendrovitz, Jocelyn Mendoza, Neo Morrison

## What the app is

It's a fitness app for people who have a hard time sticking with working out, like college students, beginners, or people with busy schedules. Most fitness apps just track numbers (steps, calories, etc.) and people get bored and quit after a few weeks. Our idea is to make it feel more like a game so people actually want to keep coming back.

You log your workouts and set goals, and you get XP for doing it. XP levels you up, working out consistently builds a streak, and there are achievements and challenges to unlock. Your profile also changes looks as you level up.

There's also an optional AI part. If you want extra help, you can connect an AI assistant (through MCP) that can look at your workout data, explain your progress, and help make a weekly plan.

## What we need to decide first

Right now our proposal kind of describes two different apps. The first half (abstract, features) is the gamified tracker with an optional AI assistant. The Feasibility and Objectives sections talk about using the phone camera to correct your form in real time, plus meal plans.

Doing all of that in one semester is a lot, so here's what we're thinking:

- **Must have:** accounts, a customizable home screen, logging workouts, goals, XP, levels, streaks, achievements, challenges, and progress charts
- **Also must have:** the AI assistant connection and a weekly AI workout plan
- **If we have time:** camera form checking for one or two lifts that are easy to film (like squats)
- **Probably cutting:** detailed meal plans and form checking for specific muscles

If everyone's good with this, we should update the Objectives section so it matches the rest of the proposal.

## Tech stack (up for a vote)

- **App:** React Native with Expo, so it works on both iPhone and Android and we can use the camera later
- **Backend:** Supabase for the database and logins (free tier, and we don't have to run our own server)
- **AI:** an MCP server in TypeScript plus an LLM API
- **Camera stuff (if we get to it):** MediaPipe or MoveNet, running on the phone so videos never get uploaded anywhere
- **Design:** Figma
- **Tracking work:** GitHub Issues and a Projects board

## How the repo will be set up

```
README.md      this file: project overview
app/           the React Native app
backend/       Supabase tables, server functions, and the gamification engine
mcp-server/    the AI assistant connection
docs/          stuff we build from
```

## Who's doing what

### Gala: UI/UX design and storyboards
- Talk to a few students/beginners (or send a quick survey) and make 2 or 3 personas
- Storyboards for the main flows: signing up, logging a workout, leveling up, doing a challenge, connecting the AI
- Wireframes, then the final screens in Figma
- Pick the colors, fonts, and buttons, and figure out what each level unlocks on your profile
- Have a few people try the prototype and fix what confuses them
- Proposal parts: Vision Statement, UX Design
- Final presentation slides and demo plan

### Vats: AI
- Build the MCP server so an AI assistant can read a user's workouts, goals, and progress
- Weekly AI workout plan and feedback (weekly instead of every workout so it doesn't cost too much)
- Safety rules so the AI doesn't suggest anything dangerous or give medical advice
- Write around 20 to 30 test cases to check that the plans make sense
- Try out camera form checking on one lift and tell us by the midpoint if it's doable
- Proposal parts: Feasibility, Objectives, the AI part of Implementation Methods, privacy

### Jocelyn: app screens and testing
- Build the app screens from Gala's designs (sign up, home, workout log, goals, profile, achievements, challenges)
- Progress charts, streak calendar, and level bar
- Let users add or remove stuff on their home screen
- Make the test plan, test each sprint, and keep track of bugs
- Proposal parts: Requirements (use cases, requirements list, use case diagram), Scope, Activities (timeline)
- Put together all the tables and figures at the end

### Neo: backend and keeping the repo running
- Set up the repo, this README, and automatic tests on pull requests
- Database setup and logins
- The XP, level, and streak rules (with a grace day, so missing one workout doesn't kill your streak)
- Hook up Jocelyn's screens and Vats's AI to the database
- Proposal parts: Development Environment, System Architecture (diagrams and data model), coding standards

### Stuff we need from each other early
- **Week 2:** Neo shares the database layout so Jocelyn and Vats can build on it
- **Week 2:** Neo and Gala agree on how much XP things are worth and how leveling works
- **Week 3:** Gala shares colors, fonts, and components so Jocelyn can start building
- **Week 3:** Vats shares what the AI server can do so Neo can connect it

## Proposal sections that still need work

| Section | Where it's at | Who |
|---|---|---|
| Abstract, Intro, Problem, Solution | Done | Gala does a final read |
| Features | Done | Neo adds the must have / if we have time split |
| Vision Statement | Empty | Gala |
| Scope | One line | Jocelyn |
| Feasibility | Done, but very camera focused | Vats |
| Objectives | Doesn't match the abstract | Vats |
| Activities | Empty | Jocelyn |
| Development Environment | Empty | Neo |
| Requirements | Empty | Jocelyn (with Gala's storyboards) |
| System Architecture | Empty | Neo |
| UX Design | Empty | Gala |
| Prototyping | Empty | Gala and Jocelyn |
| Implementation Methods | Empty | Neo and Vats |

Also, Neo needs to be added to the group members on the proposal.

## Rough timeline

- **Week 1:** agree on scope, vote on the stack, set up the repo and project board
- **Weeks 2 to 3:** personas, storyboards, wireframes, database and logins working
- **Week 3:** full proposal draft done
- **Weeks 4 to 6:** logging workouts, goals, XP, levels, and streaks all working
- **Weeks 6 to 8:** achievements, challenges, charts, and the AI plan working; decide on camera form checking
- **Weeks 8 to 9:** user testing and bug fixing
- **Week 10:** presentation and demo

## How we'll work
- Meet once a week for about 30 minutes, and post updates in the group chat
- Every task gets a GitHub Issue with someone's name on it
- Work on your own branch and open a pull request, and someone else reviews it before it gets merged
- If you change something other people depend on (like the database), give everyone a heads up first
