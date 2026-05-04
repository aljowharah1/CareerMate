import { Internship } from './Internship';

export interface Application {
  id: string;
  internshipId: string;
  internship: Internship;
  status: 'Saved' | 'Needs_Manual_Action' | 'Auto_Applied' | 'Submitted' | 'Under_Review' | 'Interview_Scheduled' | 'Offer_Received' | 'Accepted' | 'Rejected' | 'Withdrawn';
  savedDate?: string;
  appliedDate?: string;
  deadlineDate: string;
  interviewDate?: string;
  responseDate?: string;
  cvVersion: string;
  tailoredCV?: string;     // full text of the auto-tailored CV body (the cvVersion field stores the label only)
  coverLetter?: string;
  additionalDocs: string[];
  notes: string;
  aiSuggestions: string[];
  confidenceScore: number;
  interviewType?: 'Phone' | 'Video' | 'In-Person' | 'Technical' | 'HR';
  interviewLocation?: string;
  interviewNotes?: string;
  interviewerName?: string;
  offerSalary?: string;
  offerPerks?: string[];
  offerDeadline?: string;
  offerStartDate?: string;
  rejectionReason?: string;
  aiLearnings?: string[];
  createdDate: string;
  lastUpdated: string;
  autoApplied: boolean;
}
