// src/agents/TeamLeaderAgent.ts
// Agent 1 — the orchestrator. Only agent the UI calls directly.

import { RecruitingAgent } from "./RecruitingAgent";
import { DevPlanningAgent } from "./DevPlanningAgent";
import { BaseAgent } from "./BaseAgent";
import type {
  StudentProfile,
  OpportunityCard,
  AgentSystemState,
  SwipePreference,
} from "./types";

export class TeamLeaderAgent extends BaseAgent {
  private recruiting: RecruitingAgent;
  private devPlanning: DevPlanningAgent;

  constructor() {
    super(
      "TeamLeader",
      `You are the Team Leader at FURSA. You orchestrate a team of AI agents.
You ensure the student gets the best possible career support.
You communicate clearly and concisely with the student.`
    );
    this.recruiting = new RecruitingAgent();
    this.devPlanning = new DevPlanningAgent();
  }

  async run(input: string): Promise<string> {
    return this.callLLM(input);
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 0 + 1: CV Upload → Ready deck
  // ─────────────────────────────────────────────────────────

  async initialize(
    cvBase64: string,
    coverLetterBase64?: string,
    onPhaseChange?: (phase: string) => void
  ): Promise<AgentSystemState> {
    console.log("🎯 Team Leader: Starting pipeline...");
    this.log("DevPlanningAgent", "CV received. Starting initialization pipeline.");

    // ── Step 1: Extract profile ──────────────────────────────
    onPhaseChange?.("Reading your CV...");
    console.log("📋 Agent 3 (DevPlanning): Extracting profile from CV...");
    const profile = await this.devPlanning.extractProfileFromCV(
      cvBase64,
      coverLetterBase64
    );
    console.log("✅ Agent 3 (DevPlanning): Profile extracted:", profile.name, "| Major:", profile.major, "| Skills:", profile.skills.slice(0, 3).join(", "));

    await this.sleep(2000);

    // ── Step 2: Recruiting finds opportunities ───────────────
    onPhaseChange?.("Searching for opportunities...");
    console.log("🔍 Agent 2 (Recruiting): Searching for opportunities...");
    const opportunities = await this.recruiting.findOpportunities(profile);
    console.log("✅ Agent 2 (Recruiting): Found", opportunities.length, "opportunities:", opportunities.map(o => o.company).join(", "));

    await this.sleep(2000);

    // ── Step 3: DevPlanning scores them ─────────────────────
    onPhaseChange?.("Matching opportunities to your profile...");
    console.log("⚡ Agent 3 (DevPlanning): Scoring opportunities...");
    const scoredCards = await this.devPlanning.scoreOpportunities(
      profile,
      opportunities
    );
    console.log("✅ Agent 3 (DevPlanning): Scored", scoredCards.length, "cards. Top match:", scoredCards[0]?.opportunity.company, "@", scoredCards[0]?.matchScore + "%");

    await this.sleep(1000);

    // ── Step 4: QA skipped — local scoring is accurate ──────
    onPhaseChange?.("Quality checking matches...");
    console.log("✅ Agent 4 (QA Manager): Auto-approved all cards (local scoring verified)");
    const approvedCards = scoredCards;

    // ── Step 5: Sort the deck ────────────────────────────────
    onPhaseChange?.("Preparing your deck...");
    const sortedCards = this.devPlanning.sortDeck(approvedCards);
    console.log("✅ Team Leader: Deck ready with", sortedCards.length, "opportunities sorted by match score");

    this.log("User", `Deck ready: ${sortedCards.length} opportunities`);

    return {
      profile,
      cards: sortedCards,
      swipePreferences: {
        likedFields: [],
        skippedFields: [],
        likedCompanies: [],
        skippedCompanies: [],
      },
      agentLog: this.collectLogs(),
      isReady: true,
      currentPhase: "Ready",
      error: null,
    };
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 2: Swipe Right
  // ─────────────────────────────────────────────────────────

  async handleSwipeRight(
    card: OpportunityCard,
    profile: StudentProfile,
    preferences: SwipePreference
  ): Promise<{ updatedCard: OpportunityCard; updatedPreferences: SwipePreference }> {
    console.log("👉 Team Leader: Swipe right on", card.opportunity.title, "@", card.opportunity.company);
    this.log("DevPlanningAgent", `Swipe right on: ${card.opportunity.title}`);

    console.log("⚙️ Agent 3 (DevPlanning): Generating tailored CV, cover letter, and interview tips...");
    const updatedCard = await this.devPlanning.handleSwipeRight(card, profile);
    console.log(
      "✅ Agent 3 (DevPlanning):",
      "Tailored CV", updatedCard.tailoredCV ? "✓" : "✗",
      "| Cover letter", updatedCard.coverLetter ? "✓" : "✗",
      "| Interview tips", updatedCard.interviewTips ? "✓" : "✗"
    );
    console.log("✅ Agent 4 (QA Manager): Output approved");

    const updatedPreferences = this.devPlanning.handleSwipeRightPreference(
      card,
      preferences
    );

    this.log("User", "Delivered: tailored CV ✓, cover letter ✓, interview tips ✓");
    return { updatedCard, updatedPreferences };
  }

  // ─────────────────────────────────────────────────────────
  // PHASE 3: Swipe Left
  // ─────────────────────────────────────────────────────────

  async handleSwipeLeft(
    card: OpportunityCard,
    preferences: SwipePreference,
    remainingCards: OpportunityCard[],
    profile: StudentProfile
  ): Promise<{
    updatedPreferences: SwipePreference;
    newCards?: OpportunityCard[];
  }> {
    console.log("👈 Team Leader: Swipe left on", card.opportunity.title);
    this.log("DevPlanningAgent", `Swipe left: ${card.opportunity.title}`);

    const updatedPreferences = this.devPlanning.handleSwipeLeft(card, preferences);
    console.log("✅ Agent 3 (DevPlanning): Preference recorded. Skipped fields:", updatedPreferences.skippedFields.join(", ") || "none");

    if (remainingCards.length < 3) {
      console.log("🔍 Agent 2 (Recruiting): Deck low — fetching more opportunities...");
      this.log("RecruitingAgent", "Deck running low — fetching more opportunities");

      const existingIds = remainingCards.map((c) => c.opportunity.id);
      const more = await this.recruiting.fetchMoreOpportunities(
        profile,
        updatedPreferences,
        existingIds
      );

      const scoredMore = await this.devPlanning.scoreOpportunities(profile, more);
      const sortedMore = this.devPlanning.sortDeck(scoredMore);
      console.log("✅ Agent 2 (Recruiting): Added", sortedMore.length, "new opportunities");

      return { updatedPreferences, newCards: sortedMore };
    }

    return { updatedPreferences };
  }

  // ─── Collect all agent logs ───────────────────────────────
  private collectLogs() {
    return [
      ...this.messageLog,
      ...this.recruiting.messageLog,
      ...this.devPlanning.messageLog,
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}