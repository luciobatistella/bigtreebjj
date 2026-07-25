import { describe, expect, it } from 'vitest';
import { lineageSubmissionSchema } from './communitySubmissionService.js';

const requiredCertificateJourney = [
  {
    fieldName: 'certificate_blue',
    track: 'adult' as const,
    beltRank: 'blue' as const,
    beltLabel: 'Faixa azul',
    sequence: 1,
    awardedAt: ''
  },
  {
    fieldName: 'certificate_purple',
    track: 'adult' as const,
    beltRank: 'purple' as const,
    beltLabel: 'Faixa roxa',
    sequence: 2,
    awardedAt: ''
  },
  {
    fieldName: 'certificate_brown',
    track: 'adult' as const,
    beltRank: 'brown' as const,
    beltLabel: 'Faixa marrom',
    sequence: 3,
    awardedAt: ''
  },
  {
    fieldName: 'certificate_black',
    track: 'adult' as const,
    beltRank: 'black' as const,
    beltLabel: 'Faixa preta',
    sequence: 4,
    awardedAt: ''
  }
];

function submission(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Pessoa da Comunidade',
    email: 'pessoa@example.test',
    teacherName: 'Professor Responsável',
    claimType: 'black_belt_awarded_by',
    graduationTrack: 'adult',
    certificateCompletenessConfirmed: true,
    certificateManifest: requiredCertificateJourney,
    evidenceUrls: [],
    evidenceNotes: 'Relato complementar da trajetória de graduação.',
    consent: true,
    website: '',
    ...overrides
  };
}

describe('community certificate journey', () => {
  it('accepts the complete adult journey from blue through black belt', () => {
    expect(lineageSubmissionSchema.safeParse(submission()).success).toBe(true);
  });

  it('requires the applicant to confirm that every received certificate was attached', () => {
    const result = lineageSubmissionSchema.safeParse(
      submission({ certificateCompletenessConfirmed: false })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.certificateCompletenessConfirmed).toBeDefined();
    }
  });

  it('rejects a black-belt request when one mandatory graduation is missing', () => {
    const result = lineageSubmissionSchema.safeParse(
      submission({ certificateManifest: requiredCertificateJourney.slice(0, -1) })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.certificateManifest?.join(' ')).toContain('preta');
    }
  });

  it('allows juvenile certificates before the mandatory adult-color sequence', () => {
    const youthJourney = [
      {
        fieldName: 'certificate_gray',
        track: 'youth' as const,
        beltRank: 'gray' as const,
        beltLabel: 'Grupo cinza',
        sequence: 1,
        awardedAt: ''
      },
      ...requiredCertificateJourney.map((certificate, index) => ({
        ...certificate,
        track: 'youth' as const,
        sequence: index + 5
      }))
    ];

    expect(
      lineageSubmissionSchema.safeParse(
        submission({ graduationTrack: 'youth', certificateManifest: youthJourney })
    ).success
    ).toBe(true);
  });

  it('rejects certificates that do not belong to the selected journey', () => {
    const mismatchedJourney = requiredCertificateJourney.map((certificate) => ({
      ...certificate,
      track: 'youth' as const
    }));
    const result = lineageSubmissionSchema.safeParse(
      submission({ certificateManifest: mismatchedJourney })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.certificateManifest?.join(' ')).toContain(
        'trajetória selecionada'
      );
    }
  });

  it('rejects duplicate belt documents in the same journey', () => {
    const duplicatedJourney = [
      ...requiredCertificateJourney,
      {
        ...requiredCertificateJourney[0],
        fieldName: 'certificate_blue_duplicate',
        sequence: 5
      }
    ];
    const result = lineageSubmissionSchema.safeParse(
      submission({ certificateManifest: duplicatedJourney })
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.certificateManifest?.join(' ')).toContain(
        'somente um certificado'
      );
    }
  });

  it('rejects a white-belt certificate because white belt is the starting point', () => {
    const result = lineageSubmissionSchema.safeParse(
      submission({
        certificateManifest: [
          {
            fieldName: 'certificate_white',
            track: 'adult',
            beltRank: 'white',
            beltLabel: 'Faixa branca',
            sequence: 0,
            awardedAt: ''
          },
          ...requiredCertificateJourney
        ]
      })
    );

    expect(result.success).toBe(false);
  });
});
