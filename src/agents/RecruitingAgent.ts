// src/agents/RecruitingAgent.ts

import { BaseAgent } from "./BaseAgent";
import type { StudentProfile, Opportunity } from "./types";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/free";
const MAX_TOKENS = 1000;
const MAX_RESULTS = 10;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

type SerpJobResult = {
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  share_link?: string;
  apply_options?: Array<{ link?: string }>;
  related_links?: Array<{ link?: string }>;
};

type SerpOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
};

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  summary?: string;
};

// Majors students often use interchangeably — surfacing all variants widens the result pool
const MAJOR_SYNONYMS: Record<string, string[]> = {
  "computer science": ["software engineering", "computer engineering", "information technology"],
  "software engineering": ["computer science", "computer engineering"],
  "computer engineering": ["computer science", "software engineering", "electrical engineering"],
  "information technology": ["computer science", "information systems"],
  "information systems": ["information technology", "management information systems"],
  "management information systems": ["information systems", "information technology"],
  "data science": ["statistics", "analytics", "machine learning"],
  "artificial intelligence": ["machine learning", "data science", "computer science"],
  "machine learning": ["artificial intelligence", "data science"],
  "cybersecurity": ["information security", "computer science"],
  "business administration": ["management", "business management"],
  "management": ["business administration"],
  "finance": ["accounting", "economics"],
  "accounting": ["finance"],
  "marketing": ["digital marketing", "communications"],
  "electrical engineering": ["electronics engineering", "computer engineering"],
  "mechanical engineering": ["industrial engineering"],
  "industrial engineering": ["mechanical engineering", "operations"],
};

// All the words a posting might use for an early-career opportunity — joined with OR so we don't miss co-op or trainee roles
const OPPORTUNITY_KIND = `("internship" OR "co-op" OR "coop" OR "trainee" OR "intern")`;

// Cross-discipline internships students commonly accept even when they don't match the core major
const ADJACENT_FIELDS: Record<string, string[]> = {
  "software engineering": ["product management", "consulting", "business analyst"],
  "computer science": ["product management", "consulting", "data analyst"],
  "data science": ["business intelligence", "analytics consulting", "product analyst"],
  "artificial intelligence": ["product management", "research", "data science"],
  "cybersecurity": ["it audit", "risk consulting", "grc"],
  "business development": ["sales", "consulting", "operations"],
  "finance": ["consulting", "investment banking", "fintech"],
  "marketing": ["growth", "brand strategy", "content"],
  "electrical engineering": ["embedded systems", "iot", "consulting"],
  "mechanical engineering": ["industrial engineering", "manufacturing", "operations"],
  "technology": ["product management", "consulting", "business analyst"],
};

export class RecruitingAgent extends BaseAgent {
  constructor() {
    super(
      "RecruitingAgent",
      `You are a recruiting agent. Return ONLY a JSON array. No explanation. No markdown. Just raw JSON.`
    );
  }

  async run(input: string): Promise<string> {
    this.log("RecruitingAgent", `Searching: ${input.slice(0, 60)}`);
    return this.callWithMaxTokens(input);
  }

  async findOpportunities(profile: StudentProfile): Promise<Opportunity[]> {
    this.log("RecruitingAgent", `Searching for ${profile.major} internships`);

    const liveOpportunities = await this.searchLiveOpportunities(profile);
    if (liveOpportunities.length > 0) {
      console.log("RecruitingAgent: Found live opportunities:", liveOpportunities.length);
      this.log("DevPlanningAgent", `Found ${liveOpportunities.length} live opportunities, sending for scoring`);
      return liveOpportunities;
    }

    const fallback = this.getFallbackOpportunities(profile);
    console.log("RecruitingAgent: Live search unavailable, using verified fallback:", fallback.length);
    this.log("DevPlanningAgent", `Found ${fallback.length} verified opportunity sources, sending for scoring`);
    return fallback;
  }

  async fetchMoreOpportunities(
    profile: StudentProfile,
    preferences: { likedFields: string[]; skippedFields: string[] },
    existingIds: string[]
  ): Promise<Opportunity[]> {
    const seen = new Set(existingIds);
    const live = await this.searchLiveOpportunities(profile, preferences.likedFields);
    const liveFiltered = live.filter((opp) => !seen.has(opp.id) && !this.matchesSkippedField(opp, preferences.skippedFields));
    if (liveFiltered.length > 0) return liveFiltered;

    const fallback = this.getFallbackOpportunities(profile, preferences.likedFields);
    return fallback.filter((opp) => !seen.has(opp.id) && !this.matchesSkippedField(opp, preferences.skippedFields));
  }

  private matchesSkippedField(opp: Opportunity, skipped: string[]): boolean {
    if (!skipped?.length) return false;
    const fieldLower = opp.field.toLowerCase();
    return skipped.some((s) => s && fieldLower.includes(s.toLowerCase()));
  }

  private async searchLiveOpportunities(
    profile: StudentProfile,
    preferredFields?: string[]
  ): Promise<Opportunity[]> {
    const queries = this.buildSearchQueries(profile, preferredFields);
    const searches = queries.flatMap((query) => [
      this.searchTavily(query),
      this.searchSerpApi(query),
      this.searchBrave(query),
      this.searchExa(query),
    ]);

    const settled = await Promise.allSettled(searches);
    const results = settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
    return this.resultsToOpportunities(profile, this.dedupeResults(results)).slice(0, MAX_RESULTS);
  }

  private buildSearchQueries(profile: StudentProfile, preferredFields?: string[]): string[] {
    const major = profile.major || "Computer Science";
    const majorVariants = this.expandMajor(major);
    const majorOr = majorVariants.map((m) => `"${m}"`).join(" OR ");

    const fieldsSource = (preferredFields?.length ? preferredFields : profile.preferredFields) ?? [];
    const fields = fieldsSource.length > 0 ? fieldsSource.slice(0, 3) : [this.inferField(major)];
    const primaryField = fields[0];

    const location = (profile.preferredLocation?.trim()) || "Saudi Arabia";
    const isRemote = /remote/i.test(location);
    const cityHint = location.toLowerCase().includes("saudi") ? "Riyadh" : location;

    const topSkills = profile.skills.slice(0, 3).filter(Boolean);
    const skillText = topSkills.join(" ");

    const adjacent = ADJACENT_FIELDS[primaryField.toLowerCase()] ?? [];

    const queries = new Set<string>([
      `(${majorOr}) ${OPPORTUNITY_KIND} ${location} ${skillText}`.trim(),
      `${primaryField} ${OPPORTUNITY_KIND} ${cityHint} ${skillText}`.trim(),
      `${primaryField} graduate trainee program ${location}`,
      `site:linkedin.com/jobs ${primaryField} ${OPPORTUNITY_KIND} ${location}`,
      `site:linkedin.com/jobs (${majorOr}) ${OPPORTUNITY_KIND} ${cityHint}`,
    ]);

    // Saudi-specific signal — only add when targeting Saudi Arabia
    if (/saudi|riyadh|jeddah|dammam|dhahran|tabuk|neom/i.test(location)) {
      queries.add(`Tamheer ${primaryField} ${location}`);
      queries.add(`site:aramco.com OR site:neom.com OR site:misk.org.sa ${primaryField} ${OPPORTUNITY_KIND}`);
    }

    if (isRemote) {
      queries.add(`remote ${primaryField} ${OPPORTUNITY_KIND} ${skillText}`.trim());
      queries.add(`site:linkedin.com/jobs remote ${primaryField} ${OPPORTUNITY_KIND}`);
    }

    // Cross-discipline queries — a CS student may want a consulting or business-analyst opportunity
    for (const adj of adjacent.slice(0, 2)) {
      queries.add(`${adj} ${OPPORTUNITY_KIND} ${location} ${skillText}`.trim());
    }

    // Per additional preferred field from CV / liked swipes
    for (const field of fields.slice(1)) {
      queries.add(`site:linkedin.com/jobs ${field} ${OPPORTUNITY_KIND} ${location}`);
    }

    return Array.from(queries).filter((q) => q.length > 0);
  }

  private expandMajor(major: string): string[] {
    const key = major.toLowerCase().trim();
    const synonyms = MAJOR_SYNONYMS[key] ?? [];
    return [major, ...synonyms];
  }

  private async searchTavily(query: string): Promise<SearchResult[]> {
    const key = import.meta.env.VITE_TAVILY_API_KEY as string | undefined;
    if (!key) return [];

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
    });
    if (!res.ok) return [];

    const data = await res.json() as { results?: TavilyResult[] };
    return (data.results ?? []).map((item) => ({
      title: item.title ?? "Career opportunity",
      url: item.url ?? "",
      snippet: item.content ?? "",
      source: "Tavily Web Search",
    })).filter((item: SearchResult) => item.url);
  }

  private async searchSerpApi(query: string): Promise<SearchResult[]> {
    const key = import.meta.env.VITE_SERPAPI_API_KEY as string | undefined;
    if (!key) return [];

    return query.includes("site:")
      ? this.searchSerpApiOrganic(query, key)
      : this.searchSerpApiJobs(query, key);
  }

  private async searchSerpApiJobs(query: string, key: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      engine: "google_jobs",
      q: query,
      location: "Saudi Arabia",
      hl: "en",
      gl: "sa",
      api_key: key,
    });

    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];

    const data = await res.json() as { jobs_results?: SerpJobResult[] };
    return (data.jobs_results ?? []).map((job) => {
      const applyUrl = job.apply_options?.[0]?.link || job.related_links?.[0]?.link || job.share_link || "";
      return {
        title: job.title ?? "Internship opportunity",
        url: applyUrl,
        snippet: [job.company_name, job.location, job.description].filter(Boolean).join(" - "),
      source: "SerpAPI Google Jobs",
      };
    }).filter((item: SearchResult) => item.url);
  }

  private async searchSerpApiOrganic(query: string, key: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      engine: "google",
      q: query,
      location: "Saudi Arabia",
      hl: "en",
      gl: "sa",
      api_key: key,
    });

    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];

    const data = await res.json() as { organic_results?: SerpOrganicResult[] };
    return (data.organic_results ?? []).map((item) => ({
      title: item.title ?? "Career opportunity",
      url: item.link ?? "",
      snippet: item.snippet ?? item.displayed_link ?? "",
      source: "SerpAPI Google Search",
    })).filter((item: SearchResult) => item.url);
  }

  private async searchBrave(query: string): Promise<SearchResult[]> {
    const key = import.meta.env.VITE_BRAVE_SEARCH_API_KEY as string | undefined;
    if (!key) return [];

    const params = new URLSearchParams({
      q: query,
      count: "5",
      country: "sa",
      search_lang: "en",
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
    });
    if (!res.ok) return [];

    const data = await res.json() as { web?: { results?: BraveResult[] } };
    return (data.web?.results ?? []).map((item) => ({
      title: item.title ?? "Career opportunity",
      url: item.url ?? "",
      snippet: item.description ?? "",
      source: "Brave Search",
    })).filter((item: SearchResult) => item.url);
  }

  private async searchExa(query: string): Promise<SearchResult[]> {
    const key = import.meta.env.VITE_EXA_API_KEY as string | undefined;
    if (!key) return [];

    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({
        query,
        numResults: 5,
        type: "auto",
      }),
    });
    if (!res.ok) return [];

    const data = await res.json() as { results?: ExaResult[] };
    return (data.results ?? []).map((item) => ({
      title: item.title ?? "Career opportunity",
      url: item.url ?? "",
      snippet: item.text ?? item.summary ?? "",
      source: "Exa Search",
    })).filter((item: SearchResult) => item.url);
  }

  private dedupeResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = this.normalizeUrl(result.url);
      if (!key || !this.looksLikeOpportunity(result) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private normalizeUrl(url: string): string {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname}`.toLowerCase().replace(/\/+$/, "");
    } catch {
      return "";
    }
  }

  private looksLikeOpportunity(result: SearchResult): boolean {
    const title = (result.title || "").toLowerCase();
    const snippet = (result.snippet || "").toLowerCase();
    const text = `${title} ${snippet} ${(result.url || "").toLowerCase()}`;

    // Hard gate: kill aggregator search/listing pages. We only want specific job postings.
    if (this.isAggregatorListing(result.url, title, snippet)) return false;

    const hasOpportunityTerm = ["intern", "internship", "trainee", "traineeship", "graduate", "coop", "co-op", "tamheer", "vacancy", "hiring"].some((term) => text.includes(term));
    const hasBlockedTerm = ["salary survey", "salary guide", "salary report", "cv template", "resume template", "sample cv", "course", "tutorial", "udemy", "coursera", "news", "wikipedia", "press release"].some((term) => text.includes(term));
    return hasOpportunityTerm && !hasBlockedTerm;
  }

  // Detects search/listing/aggregator pages so we only surface specific job postings.
  private isAggregatorListing(rawUrl: string, title: string, snippet: string): boolean {
    const text = `${title} ${snippet}`;

    // Title/snippet shapes that signal a listing page rather than a single posting
    const listingPhrases: RegExp[] = [
      /\d+\+?\s+[\w-]+(?:\s+[\w-]+){0,4}\s+jobs?\s+in\b/i,        // "6 software engineer intern jobs in Saudi Arabia"
      /\bjobs?\s+in\s+[\w-]+(?:\s+\([^)]+\))?(?:\s*[-–|]|$)/i,    // "Jobs in Riyadh (May 2026) -" / "jobs in Riyadh - Jooble"
      /\binternships?\s+jobs?\s+in\b/i,                            // "Internships Jobs in Riyadh"
      /^\s*find\s+\w+\s+(?:jobs?|interns?|careers?)/i,
      /^\s*search\s+(?:and\s+apply\s+for\s+)?\w+/i,                // "Search and apply for the latest..."
      /^\s*browse\s+\w+\s+jobs?/i,
      /\b\d+\s+open\s+(?:jobs?|positions?)/i,                      // "30 open jobs"
      /apply\s+(?:now\s+)?to\s+over\s+\d+/i,                       // "Apply now to over 30"
      /\b\d{1,3}(?:,\d{3})*\+?\s+(?:postings?|job\s+vacanc|open\s+positions)/i, // "22,000+ postings"
      /\blatest\s+(?:internship|job|career)\s+vacanc/i,
      /\btop\s+\d+\s+(?:internships?|companies|employers)/i,
    ];
    if (listingPhrases.some((r) => r.test(text))) return true;

    let host = "";
    let path = "";
    try {
      const u = new URL(rawUrl);
      host = u.hostname.replace(/^www\./, "").toLowerCase();
      path = u.pathname.toLowerCase();
    } catch {
      return true; // unparseable URL — reject
    }

    // Pure aggregators — always listings, never trustable as a specific posting.
    // Match subdomains too (e.g. sa.jooble.org, ae.jobeka.com).
    const pureAggregators = [
      "jooble.org", "jobeka.com", "jobsora.com", "careerjet.com", "careerjet.com.sa",
      "himalayas.app", "neuvoo.com.sa", "neuvoo.com", "monster.com.sa",
      "trovit.com", "talent.com", "ziprecruiter.com", "simplyhired.com",
    ];
    if (pureAggregators.some((agg) => host === agg || host.endsWith(`.${agg}`))) return true;

    // Aggregator hosts that DO carry specific postings — accept only the specific-posting URL shape
    const specificPostingPattern: Record<string, RegExp> = {
      "linkedin.com": /^\/jobs\/view\/\d+/,
      "indeed.com": /\/viewjob/,
      "sa.indeed.com": /\/viewjob/,
      "glassdoor.com": /\/job-listing\//,
      "bayt.com": /-\d{4,}\/?$/,            // path ends with a numeric job ID
      "naukrigulf.com": /\/job-detail-/,
      "gulftalent.com": /\/jobs\/.+-\d+/,
      "efinancialcareers.com": /\/jobs\/.+\d+/,
      "jobleads.com": /\/job\/[\w-]+-\d+/,
    };
    if (host in specificPostingPattern && !specificPostingPattern[host].test(path)) return true;

    // Generic listing-path heuristics (catch-all for unknown hosts)
    if (/\/(jobs|careers|vacancies)\/(?:in-)?(?:saudi(?:-arabia)?|riyadh|jeddah|dammam|gulf|middle-east|countries)\/?$/i.test(path)) return true;
    if (/\/jobs?-in-[\w-]+/i.test(path)) return true;
    if (/^\/jobs-[a-z]/i.test(path)) return true;             // /jobs-internship-... aggregator search shape
    if (/\/q-[\w-]+\.html?$/i.test(path)) return true;
    if (/\/search\b/i.test(path)) return true;
    // LinkedIn keyword-search URL (not /jobs/view/) — covers /jobs/internship-program-jobs-riyadh
    if (host === "linkedin.com" && /^\/jobs\/[\w-]+-jobs-/.test(path)) return true;

    return false;
  }

  private resultsToOpportunities(profile: StudentProfile, results: SearchResult[]): Opportunity[] {
    const major = profile.major || "Computer Science";
    const skills = profile.skills.slice(0, 4);
    const field = profile.preferredFields?.[0] || this.inferField(major);

    return results.map((result, index) => {
      const company = this.extractCompany(result);
      return {
        id: `live-${this.slugify(result.url)}-${index}`,
        title: this.cleanTitle(result.title, field),
        company,
        field,
        location: this.inferLocation(result),
        description: result.snippet || `Live result found for ${major} students. Open the official source to review eligibility and apply.`,
        requirements: skills.length > 0 ? skills : [major, "Student or fresh graduate"],
        applyUrl: result.url,
        source: result.source,
      };
    });
  }

  private extractCompany(result: SearchResult): string {
    let host = "";
    try {
      host = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      return result.title.split(/[-|@]/)[1]?.trim() || result.source || "Saudi employer";
    }
    const known: Record<string, string> = {
      "linkedin.com": "LinkedIn Jobs",
      "aramco.com": "Saudi Aramco",
      "careers.aramco.com": "Saudi Aramco",
      "neom.com": "NEOM",
      "misk.org.sa": "Misk Foundation",
      "hub.misk.org.sa": "Misk Foundation",
      "sdaia.gov.sa": "SDAIA",
      "stc.com.sa": "STC",
      "elm.sa": "Elm Company",
      "sabic.com": "SABIC",
    };
    return known[host] || result.title.split(/[-|@]/)[1]?.trim() || host;
  }

  private cleanTitle(title: string, field: string): string {
    const cleaned = title.replace(/\s+/g, " ").replace(/<[^>]*>/g, "").trim();
    if (!cleaned) return `${field} Opportunity`;
    return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
  }

  private inferLocation(result: SearchResult): string {
    const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
    // Order matters: more specific signals first (remote/hybrid before city, NEOM before Tabuk)
    const locationMap: Array<[RegExp, string]> = [
      [/\bremote\b|work from home|wfh/, "Remote"],
      [/\bhybrid\b/, "Hybrid"],
      [/\bdhahran\b/, "Dhahran"],
      [/\bjeddah\b/, "Jeddah"],
      [/\bdammam\b/, "Dammam"],
      [/\bal[\s-]?khobar\b|\bkhobar\b/, "Al Khobar"],
      [/\bmakkah\b|\bmecca\b/, "Mecca"],
      [/\bmadinah\b|\bmedina\b/, "Medina"],
      [/\byanbu\b/, "Yanbu"],
      [/\babha\b/, "Abha"],
      [/\btaif\b/, "Taif"],
      [/\bneom\b/, "NEOM"],
      [/\btabuk\b/, "Tabuk"],
      [/\briyadh\b/, "Riyadh"],
      [/\beastern province\b/, "Eastern Province"],
      [/\bdubai\b/, "Dubai"],
      [/\babu dhabi\b/, "Abu Dhabi"],
    ];
    for (const [pattern, label] of locationMap) {
      if (pattern.test(text)) return label;
    }
    return "Saudi Arabia";
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }

  // Finds verified Saudi company opportunities tailored to the student's profile
  private getFallbackOpportunities(
    profile: StudentProfile,
    preferredFields?: string[]
  ): Opportunity[] {
    const major = profile.major || "Computer Science";
    const skills = profile.skills.slice(0, 4);
    const field = preferredFields?.[0] || profile.preferredFields?.[0] || this.inferField(major);

    const companies = [
      {
        id: `opp-aramco-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "Saudi Aramco",
        field,
        location: "Dhahran",
        description: `Join Saudi Aramco's digital transformation team. Work on real projects using ${skills.slice(0, 2).join(" and ")} to power the world's largest energy company.`,
        requirements: [...skills, "GPA 3.0+"],
        deadline: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://careers.aramco.com",
        source: "Aramco Careers",
      },
      {
        id: `opp-stc-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "STC",
        field,
        location: "Riyadh",
        description: `STC's digital innovation team is looking for ${major} students. Work on next-generation telecom applications serving millions of customers.`,
        requirements: [...skills, "Strong problem-solving"],
        deadline: new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://careers.stc.com.sa",
        source: "STC Careers",
      },
      {
        id: `opp-sdaia-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "SDAIA",
        field,
        location: "Riyadh",
        description: `The Saudi Data and AI Authority is hiring ${major} interns to contribute to national AI and data initiatives under Vision 2030.`,
        requirements: [...skills, "Passion for AI and data"],
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://sdaia.gov.sa/careers",
        source: "SDAIA Careers",
      },
      {
        id: `opp-elm-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "Elm Company",
        field,
        location: "Riyadh",
        description: `Elm provides digital services to government entities. Join as a ${field} intern and build impactful solutions for millions of Saudi citizens.`,
        requirements: [...skills, "Team player"],
        deadline: new Date(Date.now() + 45 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://elm.sa/careers",
        source: "Elm Careers",
      },
      {
        id: `opp-stcpay-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "stc pay",
        field,
        location: "Riyadh",
        description: `stc pay is Saudi Arabia's leading fintech platform. Join as a ${field} intern and work on next-generation payment and financial solutions.`,
        requirements: [...skills, "Interest in fintech"],
        deadline: new Date(Date.now() + 28 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://stcpay.com.sa/careers",
        source: "stc pay Careers",
      },
      {
        id: `opp-neom-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "NEOM",
        field,
        location: "Tabuk",
        description: `NEOM is building the future city. Contribute your ${major} skills to the most ambitious project in the world as a ${field} intern.`,
        requirements: [...skills, "Innovation mindset"],
        deadline: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://neom.com/careers",
        source: "NEOM Careers",
      },
      {
        id: `opp-sabic-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "SABIC",
        field,
        location: "Riyadh",
        description: `SABIC is a global leader in chemicals. Join their digital and ${field} team to work on cutting-edge industrial technology projects.`,
        requirements: [...skills, "Analytical mindset"],
        deadline: new Date(Date.now() + 35 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://sabic.com/careers",
        source: "SABIC Careers",
      },
      {
        id: `opp-misa-${this.slugify(field)}`,
        title: `${field} Intern`,
        company: "MISA",
        field,
        location: "Riyadh",
        description: `The Ministry of Investment Saudi Arabia is hiring ${major} interns to support digital transformation and investment facilitation initiatives.`,
        requirements: [...skills, "Strong communication"],
        deadline: new Date(Date.now() + 25 * 86400000).toISOString().split("T")[0],
        applyUrl: "https://misa.gov.sa/careers",
        source: "MISA Careers",
      },
    ];

    return companies;
  }

  // Infer the best field from the student's major
  private inferField(major: string): string {
    const m = major.toLowerCase();
    if (m.includes("computer") || m.includes("software") || m.includes("cs")) return "Software Engineering";
    if (m.includes("data") || m.includes("statistic")) return "Data Science";
    if (m.includes("ai") || m.includes("machine")) return "Artificial Intelligence";
    if (m.includes("cyber") || m.includes("security")) return "Cybersecurity";
    if (m.includes("business") || m.includes("management")) return "Business Development";
    if (m.includes("electrical") || m.includes("electronic")) return "Electrical Engineering";
    if (m.includes("mechanical")) return "Mechanical Engineering";
    if (m.includes("finance") || m.includes("accounting")) return "Finance";
    return "Technology";
  }

  private async callWithMaxTokens(prompt: string): Promise<string> {
    const key = import.meta.env.VITE_OPENROUTER_API_KEY as string;
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://fursa.app",
        "X-Title": "FURSA CareerMate",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`RecruitingAgent: ${data.error?.message ?? "API error"}`);
    return data.choices[0].message.content as string;
  }
}
