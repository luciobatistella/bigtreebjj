export type EvidenceLevel =
  | 'primary_source'
  | 'official_federation'
  | 'official_academy_or_team'
  | 'athlete_statement'
  | 'teacher_statement'
  | 'specialized_source'
  | 'community_submission'
  | 'unverified';

export type EditorialStatus =
  | 'draft'
  | 'pending_review'
  | 'confirmed'
  | 'corroborated'
  | 'disputed'
  | 'rejected'
  | 'archived';

export type ClaimType =
  | 'black_belt_awarded_by'
  | 'co_black_belt_awarded_by'
  | 'main_teacher'
  | 'technical_mentor'
  | 'trained_under'
  | 'team_member'
  | 'academy_member'
  | 'team_founder'
  | 'academy_founder'
  | 'federation_registered'
  | 'ranking_observation';

export interface Person {
  id: string;
  fullName: string;
  nicknames?: string[];
  country?: string;
  city?: string;
  createdAt: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  captureDate?: string;
  author?: string;
  curatorNotes?: string;
}

export interface LineageClaim {
  id: string;
  studentPersonId: string;
  teacherPersonId?: string;
  claimType: ClaimType;
  relationshipLabel: string;
  status: EditorialStatus;
  evidenceLevel: EvidenceLevel;
  confidenceScore: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
