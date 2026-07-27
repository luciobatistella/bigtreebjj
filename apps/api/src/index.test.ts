import { describe, expect, it } from 'vitest';
import {
  approveRelationship,
  createPerson,
  createRelationship,
  createSource
} from './domain.js';
import { previewImport } from './importService.js';
import { createReviewDecision } from './reviewService.js';

describe('basic API domain flows', () => {
  it('creates person records in a simple shape', () => {
    const person = createPerson({ fullName: 'Eddie Bravo' });

    expect(person.fullName).toBe('Eddie Bravo');
  });

  it('creates a source record with a url', () => {
    const source = createSource({ name: 'Sample source', url: 'https://example.com/source' });

    expect(source.url).toContain('https://');
  });

  it('creates and approves a relationship', () => {
    const person = createPerson({ fullName: 'Jean Jacques Machado' });
    const relationship = createRelationship({
      studentPersonId: person.id,
      teacherPersonId: 'teacher-1',
      claimType: 'black_belt_awarded_by',
      relationshipLabel: 'Black belt awarded by',
      evidenceLevel: 'community_submission',
      confidenceScore: 0.7,
      notes: 'Demo relationship'
    });

    const approved = approveRelationship(relationship.id);

    expect(relationship.status).toBe('confirmed');
    expect(approved.status).toBe('confirmed');
  });

  it('previews a CSV import and creates a review decision', () => {
    const result = previewImport('fake.csv', 'csv');
    const decision = createReviewDecision({ claimId: 'claim-1', action: 'approve', notes: 'Imported and approved' });

    expect(result.format).toBe('csv');
    expect(decision.action).toBe('approve');
  });
});
