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

    // AI reads the CV text and extracts structured profile.
    // Note: rawCV is intentionally NOT requested from the LLM — we set it ourselves below
    // from the parsed text to avoid the LLM echoing back / truncating the body.
    const prompt = `Extract structured info from this CV. Return ONLY a JSON object — no markdown, no explanation, no preamble.

Schema:
{"name":"<full name of the candidate, e.g. 'Jane Smith' — never a section header, page title, or 'Curriculum Vitae'>","email":"","major":"","university":"","gpa":"","skills":[],"experience":[],"education":[],"projects":[],"languages":[],"preferredFields":[]}

The "name" field MUST be the candidate's actual full name (typically 2-4 words, title case, found in the top portion of the CV). If you cannot identify a real person's name, use an empty string.

CV TEXT:
${cvText.slice(0, 2000)}`;

    const raw = await this.callLLM(prompt);
    console.log("🔍 Profile raw response:", raw);
    const profile = this.parseJSON<StudentProfile>(raw, this.emptyProfile());
    // Always store the full extracted text ourselves — the LLM is unreliable for this.
    profile.rawCV = cvText;
    console.log("👤 Profile parsed:", profile);

    // Validate the LLM-returned name — reject obvious non-names like "Curriculum Vitae" or section headers
    if (profile.name && !this.looksLikePersonName(profile.name)) {
      console.warn("AI returned a non-name in 'name' field:", profile.name, "→ falling back to local extraction");
      profile.name = "";
    }

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

// Heuristic check: does this string look like a real person's name?
// Rejects "Curriculum Vitae", "RESUME", "Software Engineer", page numbers, etc.
private looksLikePersonName(value: string): boolean {
  const trimmed = (value || "").trim();
  if (trimmed.length < 4 || trimmed.length > 60) return false;
  if (/\d/.test(trimmed)) return false;                     // names don't contain digits
  if (/[@:/\\|]/.test(trimmed)) return false;               // emails / URLs / paths
  // Reject common CV/resume header phrases
  const blocklist = /\b(curriculum\s+vitae|resume|c\.?v\.?|profile|cover\s+letter|page\s+\d+|references|portfolio|biography)\b/i;
  if (blocklist.test(trimmed)) return false;
  // Reject job titles that sometimes appear right under the name
  const titleBlocklist = /\b(engineer|developer|student|intern|manager|analyst|designer|consultant|specialist)\b/i;
  if (titleBlocklist.test(trimmed)) return false;
  // Must be 2-4 whitespace-separated tokens, each starting with a letter
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 4) return false;
  return tokens.every((t) => /^[A-Z][a-zA-Z'-]+$/.test(t) || /^[A-Z]+$/.test(t));
}

private parseProfileLocally(text: string): StudentProfile {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const gpaMatch = text.match(/GPA[:\s]+(\d+\.\d+)/i);
  const majorMatch = text.match(/Major[:\s]+([^\n\r]+)/i);
  const uniMatch = text.match(/University[:\s]+([^\n\r]+)/i);

  // Try explicit "Name: ..." prefix first, then scan the first 8 non-empty lines
  // for the first one that looks like a real person's name.
  const explicitNameMatch = text.match(/^\s*Name[:\s]+([^\n\r]+)/im);
  const candidateLines = text.split(/\n|\r/).map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 8);
  const detectedName =
    (explicitNameMatch && this.looksLikePersonName(explicitNameMatch[1]) ? explicitNameMatch[1].trim() : null) ||
    candidateLines.find((l) => this.looksLikePersonName(l)) ||
    'Student';

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
    name: detectedName,
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
    rawCV: text,
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
    this.log("DevPlanningAgent", "Generating tailored CV, cover letter, and interview tips in parallel");

    // Every swipe-right gets all three deliverables — generated in parallel for speed.
    // Each one independently falls back to a deterministic template if the LLM call fails.
    const [cvResult, clResult, tipsResult] = await Promise.allSettled([
      this.generateTailoredCV(card.opportunity, profile),
      this.generateCoverLetter(card.opportunity, profile),
      this.generateInterviewTips(card.opportunity, profile),
    ]);

    const tailoredCV = cvResult.status === "fulfilled" && cvResult.value?.trim()
      ? cvResult.value
      : this.fallbackTailoredCV(card.opportunity, profile);

    const coverLetter = clResult.status === "fulfilled" && clResult.value?.trim()
      ? clResult.value
      : this.fallbackCoverLetter(card.opportunity, profile);

    const interviewTips = tipsResult.status === "fulfilled" && tipsResult.value?.trim()
      ? tipsResult.value
      : this.fallbackInterviewTips(card.opportunity);

    const updated: OpportunityCard = {
      ...card,
      status: "liked" as const,
      tailoredCV,
      coverLetter,
      interviewTips,
      followUpDate: this.calculateFollowUpDate(),
    };

    this.log("QualityTestingManager", "Deliverables ready (CV + cover letter + tips), sending to QA");
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

  // ─── Tailored CV ──────────────────────────────────────────

  private async generateTailoredCV(opp: Opportunity, profile: StudentProfile): Promise<string> {
    const prompt = `Tailor this student's CV for the ${opp.title} role at ${opp.company}.

STUDENT:
- Name: ${profile.name}
- Major: ${profile.major}${profile.university ? ` at ${profile.university}` : ""}${profile.gpa ? ` (GPA ${profile.gpa})` : ""}
- Email: ${profile.email ?? ""}
- Skills: ${profile.skills.join(", ")}
- Experience: ${(profile.experience ?? []).slice(0, 5).join(" | ") || "none listed"}
- Projects: ${(profile.projects ?? []).slice(0, 4).join(" | ") || "none listed"}
- Education: ${(profile.education ?? []).slice(0, 3).join(" | ") || "none listed"}
- Languages: ${(profile.languages ?? []).join(", ") || "not specified"}

ROLE FIELD: ${opp.field}
ROLE REQUIRES: ${opp.requirements.join(", ")}

Produce a one-page tailored CV in markdown that:
- Opens with a 2-line professional summary highlighting the skills/experience most relevant to ${opp.title}.
- Reorders the Skills section so the most role-relevant skills appear first.
- Reorders Experience and Projects to lead with the most relevant items, rephrasing bullets to emphasize how they match this role's requirements.
- Keeps the student's real facts intact — DO NOT invent experience, projects, certifications, or skills that aren't in the input above.
- Uses sections: Summary, Skills, Education, Experience, Projects, Languages (omit any section the student has nothing for).
- Returns ONLY the CV markdown. No preamble, no explanation, no closing notes.`;
    return this.callLLM(prompt);
  }

  private fallbackTailoredCV(opp: Opportunity, profile: StudentProfile): string {
    const reqLower = opp.requirements.map((r) => r.toLowerCase());
    const isRelevant = (s: string) => {
      const sLower = s.toLowerCase();
      return reqLower.some((r) => sLower.includes(r) || r.includes(sLower));
    };
    const reorderedSkills = [
      ...profile.skills.filter(isRelevant),
      ...profile.skills.filter((s) => !isRelevant(s)),
    ];

    const headerLine = [profile.email, profile.university].filter(Boolean).join(" • ");
    const summary = `${profile.major} student${profile.university ? ` at ${profile.university}` : ""}${profile.gpa ? ` (GPA ${profile.gpa})` : ""} with hands-on experience in ${reorderedSkills.slice(0, 3).join(", ") || profile.major}. Targeting a ${opp.field} role at ${opp.company}.`;

    const sections: string[] = [
      `# ${profile.name}`,
      headerLine,
      "",
      `_Tailored for ${opp.title} at ${opp.company}_`,
      "",
      "## Summary",
      summary,
      "",
      "## Skills",
      reorderedSkills.length > 0
        ? reorderedSkills.map((s) => `- ${s}`).join("\n")
        : "- (no skills listed in CV)",
    ];

    if (profile.education?.length) {
      sections.push("", "## Education", ...profile.education.map((e) => `- ${e}`));
    }
    if (profile.experience?.length) {
      sections.push("", "## Experience", ...profile.experience.map((e) => `- ${e}`));
    }
    if (profile.projects?.length) {
      sections.push("", "## Projects", ...profile.projects.map((p) => `- ${p}`));
    }
    if (profile.languages?.length) {
      sections.push("", "## Languages", ...profile.languages.map((l) => `- ${l}`));
    }

    return sections.join("\n");
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