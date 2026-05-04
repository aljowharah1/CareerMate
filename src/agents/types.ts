// src/agents/types.ts

export type AgentRole =
  | "TeamLeader"
  | "RecruitingAgent"
  | "DevPlanningAgent"
  | "QualityTestingManager";

export interface AgentMessage {
  from: AgentRole;
  to: AgentRole | "User";
  content: string;
  timestamp: Date;
}

// Extracted from CV by DevPlanningAgent
export interface StudentProfile {
  name: string;
  email?: string;
  major: string;
  university?: string;
  gpa?: string;
  skills: string[];
  experience: string[];
  education: string[];
  projects?: string[];
  languages?: string[];
  preferredFields: string[];    // inferred from CV
  preferredLocation?: string;   // city or country the student wants to work in (e.g. "Riyadh", "Remote", "Saudi Arabia")
  rawCV: string;                // full CV text for cover letter context
  coverLetterStyle?: string;    // style extracted from old cover letter
}

// Found by RecruitingAgent
export interface Opportunity {
  id: string;
  title: string;
  company: string;
  field: string;
  location?: string;
  description: string;
  requirements: string[];
  deadline?: string;
  applyUrl?: string;
  source?: string;
}

// Scored + enriched by DevPlanningAgent
export interface OpportunityCard {
  opportunity: Opportunity;
  matchScore: number;           // 0-100
  matchReason: string;
  needsCoverLetter: boolean;
  coverLetter?: string;         // generated after swipe right
  interviewTips?: string;       // generated after swipe right
  followUpDate?: string;
  status: "unseen" | "liked" | "skipped" | "applied" | "interviewing" | "offered" | "rejected";
  qualityApproved: boolean;
  qualityScore?: number;
  qualityNotes?: string;
}

// Learned from swipe history
export interface SwipePreference {
  likedFields: string[];
  skippedFields: string[];
  likedCompanies: string[];
  skippedCompanies: string[];
}

// Global state shared across the app
export interface AgentSystemState {
  profile: StudentProfile | null;
  cards: OpportunityCard[];
  swipePreferences: SwipePreference;
  agentLog: AgentMessage[];
  isReady: boolean;
  currentPhase: string;
  error: string | null;
}