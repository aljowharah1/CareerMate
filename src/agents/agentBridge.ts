// src/agents/agentBridge.ts
// Converts agent types → existing FURSA app types
// so all existing components keep working without changes.

import type { Internship, Application, UserProfile } from '../types';
import type { OpportunityCard, StudentProfile } from './types';
import { generateId } from '../utils/helpers';

// ── OpportunityCard → Internship ─────────────────────────

export function cardToInternship(card: OpportunityCard): Internship {
  const o = card.opportunity;
  const now = new Date().toISOString();

  const type: Internship['type'] =
    o.field.toLowerCase().includes('business') || o.field.toLowerCase().includes('marketing')
      ? 'Business'
      : o.field.toLowerCase().includes('research')
      ? 'Research'
      : o.field.toLowerCase().includes('government') || o.field.toLowerCase().includes('public')
      ? 'Government'
      : 'Technical';

  const deadlineDate = o.deadline ? new Date(o.deadline) : new Date(Date.now() + 30 * 86400000);
  const daysLeft = (deadlineDate.getTime() - Date.now()) / 86400000;
  const status: Internship['status'] =
    daysLeft < 0 ? 'Closed' : daysLeft < 7 ? 'Closing Soon' : 'Open';

  return {
    id: o.id,
    title: o.title,
    company: o.company,
    companyLogo: '',
    location: o.location ?? 'Saudi Arabia',
    type,
    duration: '3 months',
    salary: undefined,
    deadline: deadlineDate.toISOString(),
    status,
    description: o.description,
    requirements: o.requirements,
    perks: [],
    applicationLink: o.applyUrl ?? '#',
    matchScore: card.matchScore,
    matchReasons: [card.matchReason],
    aiRecommendation: card.matchReason,
    missingRequirements: [],
    dateAdded: now,
    source: 'AI_Discovered' as const,
    tags: [o.field],
  };
}

// ── OpportunityCard → Application ────────────────────────

export function cardToApplication(card: OpportunityCard): Omit<Application, 'id'> {
  const internship = cardToInternship(card);
  const now = new Date().toISOString();

  return {
    internshipId: internship.id,
    internship,
    status: 'Needs_Manual_Action',
    savedDate: now,
    appliedDate: undefined,
    deadlineDate: internship.deadline,
    cvVersion: 'default',
    coverLetter: card.coverLetter,
    additionalDocs: [],
    notes: card.interviewTips ? `Interview Tips:\n${card.interviewTips}` : '',
    aiSuggestions: [card.matchReason],
    confidenceScore: card.matchScore,
    createdDate: now,
    lastUpdated: now,
    autoApplied: false,
  };
}

// ── StudentProfile → UserProfile ──────────────────────────
// Only maps clean scalar fields — never raw CV text or experience arrays
// to avoid dumping junk text into the profile page UI

export function studentToUserProfile(student: StudentProfile): Partial<UserProfile> {
  return {
    // Basic info — clean scalar values only
    name: student.name && student.name !== 'Unknown' ? student.name : undefined,
    email: student.email ?? undefined,
    university: student.university ?? undefined,
    major: student.major && student.major !== 'Unknown' ? student.major : undefined,
    gpa: student.gpa ? parseFloat(student.gpa) : undefined,

    // Skills array — safe to map
    skills: student.skills?.length ? student.skills : undefined,

    // Preferred fields
    preferredIndustries: student.preferredFields?.length ? student.preferredFields : undefined,
    preferredLocations: ['Riyadh', 'Saudi Arabia'],
    preferredRoleTypes: student.preferredFields?.length ? student.preferredFields : undefined,

    // NEVER map these — they contain raw CV text that would appear in the UI:
    // experience: DO NOT MAP
    // education: DO NOT MAP
    // projects: DO NOT MAP
    // rawCV: DO NOT MAP
  };
}