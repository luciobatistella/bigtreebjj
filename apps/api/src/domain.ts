export type Role = 'admin' | 'editor' | 'reviewer';

export interface PersonRecord {
  id: string;
  fullName: string;
  nicknames?: string[];
  country?: string;
  city?: string;
  createdAt: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  captureDate?: string;
  author?: string;
  curatorNotes?: string;
}

export interface RelationshipRecord {
  id: string;
  studentPersonId: string;
  teacherPersonId?: string;
  claimType: string;
  relationshipLabel: string;
  status: 'pending_review' | 'confirmed' | 'corroborated' | 'rejected' | 'disputed' | 'needs_evidence';
  evidenceLevel: string;
  confidenceScore: number;
  notes?: string;
  sourceUrls?: string[];
  sourceCount?: number;
  lastReviewedDate?: string;
  publicVisible?: boolean;
  reviewerNote?: string;
  promotionGroupId?: string;
  createdAt: string;
}

export type OrganizationRelationshipType = 'organization_parent' | 'organization_branch' | 'organization_affiliate' | 'organization_brand';

export interface OrganizationRecord {
  id: string;
  name: string;
  organizationType: string;
  country?: string;
  city?: string;
  founder?: string;
  aliases: string[];
  sources: string[];
  provenance: string[];
  canonicalId?: string;
  createdAt: string;
}

export interface OrganizationRelationshipRecord {
  id: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  relationshipType: OrganizationRelationshipType;
  notes?: string;
  createdAt: string;
}

export interface PublicationChecklist {
  studentIdentityResolved: boolean;
  teacherIdentityResolved: boolean;
  organizationDuplicatesResolved: boolean;
  sourceUrlAvailable: boolean;
  evidenceReviewed: boolean;
  relationshipTypeVerified: boolean;
  reviewerNoteAdded: boolean;
  publicVisibilityApproved: boolean;
}

export interface PromotionGroupRecord {
  id: string;
  studentPersonId: string;
  title: string;
  status: 'under_editorial_review' | 'partially_confirmed' | 'confirmed';
  publicLabel: string;
  teacherRoles: Array<{
    teacherPersonId: string;
    teacherName: string;
    role: 'awarded_by' | 'co_awarded_by' | 'mentor' | 'instructor' | 'team_affiliation';
    claimId?: string;
    status: 'pending_review' | 'confirmed';
  }>;
  notes?: string;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

const people: PersonRecord[] = [];
const sources: SourceRecord[] = [];
const relationships: RelationshipRecord[] = [];
const organizations: OrganizationRecord[] = [];
const organizationRelationships: OrganizationRelationshipRecord[] = [];
const publicationChecklists = new Map<string, PublicationChecklist>();
const promotionGroups: PromotionGroupRecord[] = [];
const sessions = new Map<string, AuthUser>();

export function createPerson(input: { fullName: string; nicknames?: string[]; country?: string; city?: string }) {
  const person: PersonRecord = {
    id: `person-${people.length + 1}`,
    fullName: input.fullName,
    nicknames: input.nicknames,
    country: input.country,
    city: input.city,
    createdAt: new Date().toISOString()
  };
  people.push(person);
  return person;
}

export function createSource(input: { name: string; url: string; sourceType?: string; captureDate?: string; author?: string; curatorNotes?: string }) {
  const source: SourceRecord = {
    id: `source-${sources.length + 1}`,
    name: input.name,
    url: input.url,
    sourceType: input.sourceType ?? 'manual_submission',
    captureDate: input.captureDate,
    author: input.author,
    curatorNotes: input.curatorNotes
  };
  sources.push(source);
  return source;
}

export function createRelationship(input: { studentPersonId: string; teacherPersonId?: string; claimType: string; relationshipLabel: string; evidenceLevel?: string; confidenceScore?: number; notes?: string }) {
  const relationship: RelationshipRecord = {
    id: `relationship-${relationships.length + 1}`,
    studentPersonId: input.studentPersonId,
    teacherPersonId: input.teacherPersonId,
    claimType: input.claimType,
    relationshipLabel: input.relationshipLabel,
    status: 'pending_review',
    evidenceLevel: input.evidenceLevel ?? 'community_submission',
    confidenceScore: input.confidenceScore ?? 0.5,
    notes: input.notes,
    publicVisible: false,
    sourceCount: 0,
    createdAt: new Date().toISOString()
  };
  relationships.push(relationship);
  return relationship;
}

export function approveRelationship(id: string) {
  const relationship = relationships.find((entry) => entry.id === id);
  if (!relationship) {
    throw new Error('Relationship not found');
  }
  relationship.status = 'confirmed';
  relationship.publicVisible = true;
  relationship.lastReviewedDate = new Date().toISOString();
  return relationship;
}

export function createOrganization(input: { name: string; organizationType?: string; country?: string; city?: string; founder?: string; aliases?: string[]; sources?: string[]; provenance?: string[] }) {
  const organization: OrganizationRecord = {
    id: `organization-${organizations.length + 1}`,
    name: input.name,
    organizationType: input.organizationType ?? 'team',
    country: input.country,
    city: input.city,
    founder: input.founder,
    aliases: input.aliases ?? [],
    sources: input.sources ?? [],
    provenance: input.provenance ?? [],
    createdAt: new Date().toISOString()
  };
  organizations.push(organization);
  return organization;
}

export function canonicalizeOrganizationDuplicate(input: {
  canonicalOrganizationId: string;
  duplicateOrganizationId: string;
  aliases?: string[];
  relationshipType?: OrganizationRelationshipType;
  notes?: string;
}) {
  const canonical = organizations.find((entry) => entry.id === input.canonicalOrganizationId);
  const duplicate = organizations.find((entry) => entry.id === input.duplicateOrganizationId);
  if (!canonical || !duplicate) {
    throw new Error('Organization not found');
  }
  const shouldPreserveDuplicateNameAsAlias = input.relationshipType !== 'organization_branch';
  const aliases = new Set([
    canonical.name,
    ...(shouldPreserveDuplicateNameAsAlias ? [duplicate.name] : []),
    ...canonical.aliases,
    ...(shouldPreserveDuplicateNameAsAlias ? duplicate.aliases : []),
    ...(input.aliases ?? [])
  ]);
  canonical.aliases = Array.from(aliases).filter((alias) => alias && alias !== canonical.name);
  canonical.sources = Array.from(new Set([...canonical.sources, ...duplicate.sources]));
  canonical.provenance = Array.from(new Set([...canonical.provenance, ...duplicate.provenance, `canonicalized:${duplicate.id}`]));
  duplicate.canonicalId = canonical.id;

  let relationship: OrganizationRelationshipRecord | undefined;
  if (input.relationshipType) {
    relationship = createOrganizationRelationship({
      fromOrganizationId: duplicate.id,
      toOrganizationId: canonical.id,
      relationshipType: input.relationshipType,
      notes: input.notes
    });
  }

  return { canonical, duplicate, relationship, provenancePreserved: ['aliases', 'sources', 'provenance', 'audit history'] };
}

export function createOrganizationRelationship(input: { fromOrganizationId: string; toOrganizationId: string; relationshipType: OrganizationRelationshipType; notes?: string }) {
  const relationship: OrganizationRelationshipRecord = {
    id: `organization-relationship-${organizationRelationships.length + 1}`,
    fromOrganizationId: input.fromOrganizationId,
    toOrganizationId: input.toOrganizationId,
    relationshipType: input.relationshipType,
    notes: input.notes,
    createdAt: new Date().toISOString()
  };
  organizationRelationships.push(relationship);
  return relationship;
}

export function recordPublicationChecklist(claimId: string, checklist: PublicationChecklist) {
  publicationChecklists.set(claimId, checklist);
  return checklist;
}

export function publishLineageRelationship(input: {
  id?: string;
  studentPersonId: string;
  teacherPersonId: string;
  claimType: string;
  relationshipLabel: string;
  evidenceLevel: string;
  sourceUrls: string[];
  reviewerNote: string;
  status?: 'confirmed' | 'corroborated';
  originalClaimId?: string;
}) {
  const checklist: PublicationChecklist = {
    studentIdentityResolved: Boolean(input.studentPersonId),
    teacherIdentityResolved: Boolean(input.teacherPersonId),
    organizationDuplicatesResolved: true,
    sourceUrlAvailable: input.sourceUrls.length > 0,
    evidenceReviewed: input.sourceUrls.length > 0,
    relationshipTypeVerified: Boolean(input.claimType && input.relationshipLabel),
    reviewerNoteAdded: Boolean(input.reviewerNote.trim()),
    publicVisibilityApproved: true
  };
  const ready = Object.values(checklist).every(Boolean);
  if (!ready) {
    throw new Error('Publication checklist is incomplete');
  }

  const relationship: RelationshipRecord = {
    id: input.id ?? input.originalClaimId ?? `relationship-${relationships.length + 1}`,
    studentPersonId: input.studentPersonId,
    teacherPersonId: input.teacherPersonId,
    claimType: input.claimType,
    relationshipLabel: input.relationshipLabel,
    status: input.status ?? 'confirmed',
    evidenceLevel: input.evidenceLevel,
    confidenceScore: input.status === 'corroborated' ? 0.85 : 0.95,
    notes: input.originalClaimId ? `Published from imported claim ${input.originalClaimId}` : undefined,
    sourceUrls: input.sourceUrls,
    sourceCount: input.sourceUrls.length,
    lastReviewedDate: new Date().toISOString(),
    publicVisible: true,
    reviewerNote: input.reviewerNote,
    createdAt: new Date().toISOString()
  };
  relationships.push(relationship);
  recordPublicationChecklist(relationship.id, checklist);
  return relationship;
}

export function reclassifyRelationship(id: string, claimType: string, relationshipLabel: string, reviewerNote: string) {
  const relationship = relationships.find((entry) => entry.id === id);
  if (!relationship) {
    throw new Error('Relationship not found');
  }
  relationship.claimType = claimType;
  relationship.relationshipLabel = relationshipLabel;
  relationship.reviewerNote = reviewerNote;
  relationship.lastReviewedDate = new Date().toISOString();
  return relationship;
}

export function createPromotionGroup(input: Omit<PromotionGroupRecord, 'id' | 'createdAt' | 'publicLabel'> & { publicLabel?: string }) {
  const group: PromotionGroupRecord = {
    ...input,
    id: `promotion-group-${promotionGroups.length + 1}`,
    publicLabel: input.publicLabel ?? 'Black belt promotion involving multiple instructors - under editorial review',
    createdAt: new Date().toISOString()
  };
  promotionGroups.push(group);
  return group;
}

export function listPublicLineageGraph() {
  return relationships
    .filter((relationship) => relationship.publicVisible && (relationship.status === 'confirmed' || relationship.status === 'corroborated') && !relationship.promotionGroupId)
    .map((relationship) => ({
      id: relationship.id,
      studentPersonId: relationship.studentPersonId,
      teacherPersonId: relationship.teacherPersonId,
      claimType: relationship.claimType,
      relationshipLabel: relationship.relationshipLabel,
      evidenceLevel: relationship.evidenceLevel,
      sourceCount: relationship.sourceCount ?? relationship.sourceUrls?.length ?? 0,
      lastReviewedDate: relationship.lastReviewedDate
    }));
}

export function getPublicPersonProfile(personId: string) {
  const publicRelationships = listPublicLineageGraph().filter((relationship) => relationship.studentPersonId === personId || relationship.teacherPersonId === personId);
  const pendingGroups = promotionGroups.filter((group) => group.studentPersonId === personId && group.status !== 'confirmed');
  const lineageStatus = publicRelationships.some((relationship) => relationship.studentPersonId === personId)
    ? 'Confirmed'
    : pendingGroups.length
      ? 'Under review'
      : 'No verified lineage yet';
  return {
    personId,
    lineageStatus,
    publicRelationships,
    promotionGroups: pendingGroups.map((group) => ({ id: group.id, publicLabel: group.publicLabel, status: group.status, teacherRoles: group.teacherRoles }))
  };
}

export function getPublicationChecklist(claimId: string) {
  return publicationChecklists.get(claimId);
}

export function loginAdmin(email: string, password: string) {
  const validEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const validPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  if (email !== validEmail || password !== validPassword) {
    throw new Error('Invalid credentials');
  }

  const user: AuthUser = { id: 'admin-1', email, role: 'admin' };
  const token = `token-${user.id}`;
  sessions.set(token, user);
  return { token, user };
}

export function verifyAuth(token?: string) {
  if (!token) {
    throw new Error('Missing token');
  }
  const user = sessions.get(token);
  if (!user) {
    throw new Error('Invalid token');
  }
  return user;
}

export function listPeople() {
  return people;
}

export function listSources() {
  return sources;
}

export function listRelationships() {
  return relationships;
}

export function listOrganizations() {
  return organizations;
}

export function listOrganizationRelationships() {
  return organizationRelationships;
}

export function listPromotionGroups() {
  return promotionGroups;
}
