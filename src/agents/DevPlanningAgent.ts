// src/agents/DevPlanningAgent.ts
// Agent 3 — CV parsing, match scoring, cover letters, interview tips, planning.

import { BaseAgent } from "./BaseAgent";
import type {
  StudentProfile,
  Opportunity,
  OpportunityCard,
  SwipePreference,
} from "./types";

export class DevPlanningAgent extends BaseAgent {
  constructor() {
    super(
      "DevPlanningAgent",
      `You are the Development & Planning Agent at FURSA, a career platform for university students in Saudi Arabia.
You extract student profiles from CVs, score internship matches, write cover letters, and generate interview tips.
Always be specific and use actual details from the student profile.
When writing cover letters: professional, 3-4 paragraphs, tailored to the specific role.
When scoring: be honest and data-driven.`
    );
  }

  async run(input: string): Promise<string> {
    return this.callLLM(input);
  }

  // ─── PHASE 0: CV Parsing — AI reads the CV ────────────────

  async extractProfileFromCV(
    cvBase64: string,
    coverLetterBase64?: string
  ): Promise<StudentProfile> {
    this.log("DevPlanningAgent", "Reading CV and extracting student profile");

    // Extract text from PDF first
    const cvText = await this.base64ToText(cvBase64);
    console.log("📄 CV text extracted, length:", cvText.length);

    if (!cvText || cvText.length < 50) {
      console.warn("CV text too short, using fallback parsing");
      return this.emptyProfile();
    }

    // AI reads the CV text and extracts structured profile
    const prompt = `Extract info from this CV. Return ONLY JSON, no markdown, no explanation:
{"name":"","email":"","major":"","university":"","gpa":"","skills":[],"experience":[],"education":[],"projects":[],"languages":[],"preferredFields":[],"rawCV":"","coverLetterStyle":null}

CV:
${cvText.slice(0, 1500)}`;

    const raw = await this.callLLM(prompt);
    console.log("🔍 Profile raw response:", raw);
    const profile = this.parseJSON<StudentProfile>(raw, this.emptyProfile());
    console.log("👤 Profile parsed:", profile);

    // If AI failed to extract name, fall back to local parsing
    if (!profile.name || profile.name === "Unknown" || profile.name === "") {
      console.log("AI extraction incomplete, enhancing with local parsing");
      const local = this.parseProfileLocally(cvText);
      profile.name = profile.name || local.name;
      profile.email = profile.email || local.email;
      profile.major = profile.major || local.major;
      profile.university = profile.university || local.university;
      profile.gpa = profile.gpa || local.gpa;
      profile.skills = profile.skills?.length ? profile.skills : local.skills;
      profile.preferredFields = profile.preferredFields?.length ? profile.preferredFields : local.preferredFields;
    }

    if (coverLetterBase64) {
      try {
        const clText = await this.base64ToText(coverLetterBase64);
        const stylePrompt = `Analyze the writing style of this cover letter in 2 sentences. What tone and structure does the author use?\n\n${clText.slice(0, 1000)}`;
        profile.coverLetterStyle = await this.callLLM(stylePrompt);
      } catch {
        // Style extraction is optional
      }
    }

    this.log("TeamLeader", "Profile extracted successfully");
    return profile;
  }

  // Proper PDF text extraction using pdfjs-dist from node_modules
  // Replace the parseProfileLocally method in DevPlanningAgent.ts with this:

private parseProfileLocally(text: string): StudentProfile {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const gpaMatch = text.match(/GPA[:\s]+(\d+\.\d+)/i);
  const majorMatch = text.match(/Major[:\s]+([^\n\r]+)/i);
  const uniMatch = text.match(/University[:\s]+([^\n\r]+)/i);

  // Name is always the first non-empty line
  const firstLine = text.split(/\n|\r/)
    .map(l => l.trim())
    .find(l => l.length > 2 && l.length < 60 && !l.includes('@') && !l.includes(':'));

  const skillsSection = text.match(/SKILLS?\s*\n?([\s\S]+?)(?=EDUCATION|EXPERIENCE|PROJECTS|LANGUAGES|CERTIFICATIONS|$)/i);
  const skills = skillsSection
    ? skillsSection[1]
        .replace(/\n/g, ',')
        .split(/,/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 30 && !s.match(/^\d/))
    : [];

  const major = majorMatch ? majorMatch[1].trim() : 'Computer Science';
  const university = uniMatch ? uniMatch[1].trim() : undefined;

  return {
    name: firstLine || 'Student',
    email: emailMatch?.[0],
    major,
    university,
    gpa: gpaMatch ? gpaMatch[1] : undefined,
    skills: skills.slice(0, 12),
    experience: [],
    education: [],
    projects: [],
    languages: [],
    preferredFields: this.inferPreferredFields(major, skills),
    rawCV: text.slice(0, 200), // Keep short — just for reference
  };
}

  private async base64ToText(base64: string): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    const workerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.toString();

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
    }

    console.log("📄 PDF properly extracted:", fullText.slice(0, 200));
    return fullText;
  } catch (e) {
    console.error("PDF extraction failed:", e);
    return "";
  }
}

  private inferPreferredFields(major: string, skills: string[]): string[] {
    const m = major.toLowerCase();
    const s = skills.map(sk => sk.toLowerCase()).join(" ");
    const fields: string[] = [];
    if (m.includes("computer") || m.includes("software") || s.includes("react") || s.includes("python")) fields.push("Software Engineering");
    if (s.includes("sql") || s.includes("data") || s.includes("machine learning")) fields.push("Data Science");
    if (s.includes("machine learning") || s.includes("ai") || s.includes("nlp")) fields.push("Artificial Intelligence");
    if (s.includes("cyber") || s.includes("security")) fields.push("Cybersecurity");
    if (fields.length === 0) fields.push("Technology");
    return fields;
  }

  // ─── PHASE 1: Score opportunities — AI scores them ────────

  async scoreOpportunities(
    profile: StudentProfile,
    opportunities: Opportunity[]
  ): Promise<OpportunityCard[]> {
    this.log("DevPlanningAgent", `Scoring ${opportunities.length} opportunities against profile`);

    // Local scoring as guaranteed base
    const localCards = this.scoreLocally(profile, opportunities);

    // AI enhances the scores
    try {
      const prompt = `Score these internships for a ${profile.major} student with skills: ${profile.skills.slice(0, 5).join(", ")}.

Opportunities:
${opportunities.slice(0, 5).map((o, i) => `[${i}] id:${o.id} | ${o.title} at ${o.company} | requires: ${o.requirements.slice(0, 3).join(", ")}`).join("\n")}

Return ONLY a JSON array (no markdown, no explanation):
[{"id":"same-id","matchScore":85,"matchReason":"reason","needsCoverLetter":true}]`;

      const raw = await this.callLLM(prompt);
      const aiScores = this.parseJSON<Array<{
        id: string;
        matchScore: number;
        matchReason: string;
        needsCoverLetter: boolean;
      }>>(raw, []);

      if (aiScores.length > 0) {
        return localCards.map((card) => {
          const ai = aiScores.find((s) => s.id === card.opportunity.id);
          if (!ai) return card;
          return {
            ...card,
            matchScore: ai.matchScore,
            matchReason: ai.matchReason,
            needsCoverLetter: ai.needsCoverLetter,
          };
        });
      }
    } catch {
      console.log("DevPlanningAgent: AI scoring failed, using local scores");
    }

    this.log("QualityTestingManager", `${localCards.length} cards ready`);
    return localCards;
  }

  // Local scoring fallback
  private scoreLocally(
    profile: StudentProfile,
    opportunities: Opportunity[]
  ): OpportunityCard[] {
    const studentSkills = profile.skills.map((s) => s.toLowerCase());
    const studentMajor = profile.major.toLowerCase();

    return opportunities.map((opp) => {
      const reqSkills = opp.requirements.map((r) => r.toLowerCase());
      const matched = reqSkills.filter((req) =>
        studentSkills.some((skill) => skill.includes(req) || req.includes(skill))
      );

      let score = reqSkills.length > 0
        ? Math.round((matched.length / reqSkills.length) * 70)
        : 50;

      if (
        opp.field.toLowerCase().includes(studentMajor) ||
        studentMajor.includes(opp.field.toLowerCase()) ||
        profile.preferredFields.some((f) => f.toLowerCase().includes(opp.field.toLowerCase()))
      ) score += 20;

      if (profile.preferredFields.some((f) => opp.field.toLowerCase().includes(f.toLowerCase()))) score += 10;

      score = Math.min(95, Math.max(30, score));

      const matchReason = matched.length > 0
        ? `Your ${matched.slice(0, 2).join(" and ")} skills match ${matched.length} of ${reqSkills.length} requirements`
        : `Your ${profile.major} background is relevant to this ${opp.field} role`;

      const corporateCompanies = ["aramco", "stc", "sabic", "sdaia", "neom", "elm", "misa", "bank", "ministry"];
      const needsCoverLetter = corporateCompanies.some((c) => opp.company.toLowerCase().includes(c));

      return {
        opportunity: opp,
        matchScore: score,
        matchReason,
        needsCoverLetter,
        qualityApproved: true,
        status: "unseen" as const,
      };
    });
  }

  // ─── PHASE 1: Sort the deck ───────────────────────────────

  sortDeck(cards: OpportunityCard[]): OpportunityCard[] {
    this.log("DevPlanningAgent", "Sorting deck by match score and deadline");
    return [...cards].sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      const dateA = a.opportunity.deadline ? new Date(a.opportunity.deadline).getTime() : Infinity;
      const dateB = b.opportunity.deadline ? new Date(b.opportunity.deadline).getTime() : Infinity;
      return dateA - dateB;
    });
  }

  // ─── PHASE 2: Swipe Right ─────────────────────────────────

  async handleSwipeRight(
    card: OpportunityCard,
    profile: StudentProfile
  ): Promise<OpportunityCard> {
    this.log("DevPlanningAgent", `Swipe right: ${card.opportunity.title} at ${card.opportunity.company}`);
    const updated = { ...card, status: "liked" as const };

    if (card.needsCoverLetter) {
      this.log("DevPlanningAgent", "Generating cover letter...");
      try {
        updated.coverLetter = await this.generateCoverLetter(card.opportunity, profile);
      } catch {
        updated.coverLetter = this.fallbackCoverLetter(card.opportunity, profile);
      }
    }

    try {
      updated.interviewTips = await this.generateInterviewTips(card.opportunity, profile);
    } catch {
      updated.interviewTips = this.fallbackInterviewTips(card.opportunity);
    }

    updated.followUpDate = this.calculateFollowUpDate();
    this.log("QualityTestingManager", "Deliverables ready, sending to QA");
    return updated;
  }

  // ─── PHASE 3: Swipe Left ──────────────────────────────────

  handleSwipeLeft(card: OpportunityCard, preferences: SwipePreference): SwipePreference {
    this.log("DevPlanningAgent", `Swipe left: ${card.opportunity.title}`);
    return {
      ...preferences,
      skippedFields: preferences.skippedFields.includes(card.opportunity.field)
        ? preferences.skippedFields
        : [...preferences.skippedFields, card.opportunity.field],
      skippedCompanies: [...preferences.skippedCompanies, card.opportunity.company],
    };
  }

  handleSwipeRightPreference(card: OpportunityCard, preferences: SwipePreference): SwipePreference {
    return {
      ...preferences,
      likedFields: preferences.likedFields.includes(card.opportunity.field)
        ? preferences.likedFields
        : [...preferences.likedFields, card.opportunity.field],
      likedCompanies: [...preferences.likedCompanies, card.opportunity.company],
    };
  }

  // ─── Cover letter ─────────────────────────────────────────

  private async generateCoverLetter(opp: Opportunity, profile: StudentProfile): Promise<string> {
    const prompt = `Write a professional cover letter for ${profile.name} applying to ${opp.title} at ${opp.company}.
Student skills: ${profile.skills.slice(0, 5).join(", ")}.
Role requires: ${opp.requirements.slice(0, 4).join(", ")}.
3-4 paragraphs. Start with "Dear Hiring Manager,". No preamble.`;
    return this.callLLM(prompt);
  }

  private fallbackCoverLetter(opp: Opportunity, profile: StudentProfile): string {
    return `Dear Hiring Manager,

I am writing to express my strong interest in the ${opp.title} position at ${opp.company}. As a ${profile.major} student at ${profile.university || "university"}, I am excited by the opportunity to contribute to your team.

My background in ${profile.skills.slice(0, 3).join(", ")} aligns well with the requirements of this role. Through my academic projects and coursework, I have developed practical skills that I am eager to apply in a professional setting at ${opp.company}.

I am particularly drawn to ${opp.company} because of its impact and reputation in the industry. I am confident that my skills and enthusiasm would make me a valuable addition to your team.

Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to ${opp.company}.

Sincerely,
${profile.name}`;
  }

  // ─── Interview tips ───────────────────────────────────────

  private async generateInterviewTips(opp: Opportunity, profile: StudentProfile): Promise<string> {
    const prompt = `Give 4 interview tips for a ${profile.major} student interviewing for ${opp.title} at ${opp.company}. Be specific and practical. No preamble.`;
    return this.callLLM(prompt);
  }

  private fallbackInterviewTips(opp: Opportunity): string {
    return `Interview Tips for ${opp.title} at ${opp.company}:

1. Research ${opp.company}'s recent projects and Vision 2030 contributions before the interview.
2. Prepare examples of past projects that demonstrate skills in: ${opp.requirements.slice(0, 3).join(", ")}.
3. Practice the STAR method (Situation, Task, Action, Result) for behavioral questions.
4. Prepare 2-3 thoughtful questions to ask the interviewer about the team and growth opportunities.`;
  }

  // ─── Utilities ────────────────────────────────────────────

  private calculateFollowUpDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0];
  }

  private emptyProfile(): StudentProfile {
    return {
      name: "Unknown",
      major: "Unknown",
      skills: [],
      experience: [],
      education: [],
      preferredFields: [],
      rawCV: "",
    };
  }
}