# FURSA
**F**inding **U**nique **R**oles through **S**mart **A**I

A React-based agentic AI web app that helps Saudi university students find co-op and internship opportunities. The student uploads a CV; four specialized AI agents handle everything else — opportunity discovery, match scoring, tailored CV and cover letter generation, interview preparation, and application tracking.

Built for **CS496 — Emerging Topics in AI and Data Science**, Prince Sultan University, Spring 2026.

| Name | Student ID |
|------|------------|
| Aljowharah Aljubair | 222410187 |
| Sarah Alkahwaji | 222410358 |

---

## Overview

FURSA is structured as both a student-facing product and an autonomous agentic organization:

- **Student-facing:** a Tinder-style swipe interface for internships, an AI career assistant ("Mate"), and an automatic application tracker.
- **Agentic backend:** a coordinated team of four AI agents that read CVs, search the live web for real opportunities, score matches, generate role-tailored CVs and cover letters, and gate every output through quality review.

The only manual step the student takes is uploading their CV. Everything downstream is autonomous.

## The Four Agents

| # | Agent | Role |
|---|---|---|
| 1 | **Team Leader** | Orchestrates the pipeline. Only agent that talks to the UI. Delegates to specialists in sequence and returns the final ranked deck. |
| 2 | **Recruiting Agent** | Generates search queries from the CV (major + skills + preferred fields + location), calls live search APIs (Tavily, SerpAPI Google Jobs, Brave, Exa) including public LinkedIn job pages, filters out aggregator listing pages, and returns specific job postings. Falls back to a verified Saudi employer list if no live results. |
| 3 | **Dev & Planning Agent** | The workhorse — CV text extraction (`pdfjs-dist`), profile extraction (LLM + regex fallback), match scoring, tailored CV generation, cover letter generation, interview tips, and follow-up scheduling. |
| 4 | **Quality & Testing Manager** | The gatekeeper. Reviews every output (profile, scores, cover letters) on a 1–10 scale; ≥7 approved, anything lower returned with an improved version. |

## Features

- CV upload → automatic profile extraction (no manual fields)
- Live web search for real internship postings, including public LinkedIn results
- Aggregator-listing filter (kills Glassdoor search pages, Bayt category pages, Jooble, etc.)
- Major synonym expansion (CS ↔ SE ↔ CE) so cross-tagged jobs surface
- Cross-discipline queries (e.g. CS → consulting / business analyst) so students see relevant non-tech opportunities
- Location-aware queries (Riyadh, Jeddah, Dhahran, Tabuk/NEOM, Remote, etc.)
- Swipe-based discovery — right to save and apply, left to pass
- **Auto-generated tailored CV + cover letter on every swipe-right**, downloadable as Markdown from the Track page
- Interview prep tips per role
- Swipe preference learning (liked/skipped fields bias future searches)
- Automatic deck refilling when cards run low
- AI career chat ("Mate") — strictly scoped to career topics, refuses off-topic prompts and resists prompt-injection attempts
- Application tracking with timeline, status filters, and AI insights

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite 8
- **Routing:** react-router-dom 7
- **Animations / gestures:** @react-spring/web, @use-gesture/react
- **PDF parsing:** pdfjs-dist 5
- **Styling:** CSS Modules
- **LLM provider:** OpenRouter (free models, with a fallback chain for the chatbot)
- **Search providers:** Tavily, SerpAPI Google Jobs, Brave Search, Exa
- **Persistence:** localStorage via `dataService`

## Getting Started

### Prerequisites

- **Node.js v18 or higher** — verify with `node --version`. Download from [nodejs.org](https://nodejs.org/) if missing.
- **npm** — comes bundled with Node.js. Verify with `npm --version`.

### 1. Install dependencies

From the project root:

```bash
npm install
```

This installs React, Vite, pdfjs-dist, the animation/gesture libraries, and everything else listed in `package.json`. Takes ~30–60 seconds.

### 2. Configure environment variables

The submission already includes a working `.env` file at the project root with valid API keys for OpenRouter, Tavily, and SerpAPI — so you can skip ahead to step 3.

If `.env` is missing, create one with the following keys:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-...      # required — used by all agents and the Mate chatbot
VITE_TAVILY_API_KEY=tvly-dev-...          # optional — live web search
VITE_SERPAPI_API_KEY=...                  # optional — structured Google Jobs results
VITE_BRAVE_SEARCH_API_KEY=...             # optional — independent web index
VITE_EXA_API_KEY=...                      # optional — neural search
```

Only the OpenRouter key is strictly required. With no search keys, the Recruiting Agent falls back to a verified Saudi employer list (Aramco, STC, SDAIA, Elm, stc pay, NEOM, SABIC, MISA) so the demo still works.

### 3. Run the dev server

```bash
npm run dev
```

Vite will start on `http://localhost:5173`. Open the URL in a browser (Chrome or Edge recommended). If port 5173 is in use, Vite will pick the next free one and print the URL.

### 4. Walk through the demo

1. The first screen prompts for a CV upload — pick any PDF CV (a sample one is included in the submission).
2. Watch the four-agent pipeline run: *Read CV → Find Jobs → Score → QA Check*. The DevTools console (F12) shows live logs from each agent.
3. The **Discover** screen appears with a deck of matched internships, sorted by match score.
4. **Swipe right** to apply, **swipe left** to pass, or tap the card for full details. On swipe-right the Dev & Planning agent generates a tailored CV + cover letter in the background — a toast notification confirms when they're ready (~5–15 seconds).
5. Open the **Track** tab → click any saved application → the *Auto-Generated Documents* section has **Download** buttons for the tailored CV and cover letter (saved as Markdown files).
6. Open the **Mate** tab to chat with the AI career assistant. Off-topic questions (weather, recipes, etc.) are politely refused.

### Build for production

```bash
npm run build
```

Outputs an optimized bundle to `dist/`. Preview locally with `npm run preview`.

### Troubleshooting

- **"VITE_OPENROUTER_API_KEY is missing"** → `.env` is missing or wasn't loaded. Make sure the file is at the project root (next to `package.json`) and restart `npm run dev` (Vite only reads `.env` on startup).
- **No internships appear after CV upload** → check the DevTools Console for agent errors; usually means a network issue or the OpenRouter key is invalid.
- **Tailored CV / cover letter never appear in Track** → expected to take 5–15 seconds after swipe-right. Watch the console for `[useSwipe] Deliverables ready for ...`.

## Project Structure

```
src/
├── agents/                       # Agentic layer
│   ├── TeamLeaderAgent.ts        # Agent 1 — orchestrator
│   ├── RecruitingAgent.ts        # Agent 2 — opportunity discovery
│   ├── DevPlanningAgent.ts       # Agent 3 — CV parsing, scoring, CV/cover letter generation
│   ├── QualityTestingManager.ts  # Agent 4 — QA gate
│   ├── BaseAgent.ts              # Shared LLM call infrastructure
│   ├── agentBridge.ts            # Adapters between agent types and app types
│   └── types.ts
├── context/                      # AgentContext, UserContext, AppContext
├── pages/                        # DiscoverPage, TrackPage, ProfilePage, AIChatPage, AboutPage
├── components/                   # swipe, applications, internships, ai
├── services/
│   ├── ai/chatbot.ts             # Mate — career-restricted assistant
│   ├── api/                      # Application, document, user APIs
│   └── storage/dataService.ts    # localStorage persistence
├── hooks/                        # useAI, useSwipe, useProfile, useApplications
├── types/                        # TypeScript type definitions
├── utils/                        # Helpers, formatters, constants
├── App.tsx
└── main.tsx
```

## How the Pipeline Runs

```
                ┌─────────────────────────────┐
                │   Student uploads CV (PDF)  │
                └──────────────┬──────────────┘
                               ▼
              ┌────────────────────────────────────┐
              │  Agent 1 — Team Leader             │
              │  Coordinates, never does the work  │
              └──────────────┬─────────────────────┘
                             │
   ┌─────────────────────────┼─────────────────────────┐
   ▼                         ▼                         ▼
┌────────┐           ┌──────────────┐         ┌────────────────┐
│Agent 3 │           │   Agent 2    │         │    Agent 4     │
│Parse CV│   ───►    │  Search live │  ───►   │   Quality gate │
│Score   │           │  internships │         │   ≥7 = approve │
│Generate│           └──────────────┘         └────────────────┘
└────────┘
                             │
                             ▼
              ┌────────────────────────────────┐
              │  Ranked deck → Discover screen │
              └────────────────────────────────┘
```

When the student swipes right, Agent 3 fires three parallel LLM calls — tailored CV, cover letter, interview tips — each with a deterministic fallback if the LLM fails. The application is added to the Track page with both documents available as Markdown downloads.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — TypeScript compile + Vite production build
- `npm run lint` — ESLint
- `npm run preview` — preview the production build locally
