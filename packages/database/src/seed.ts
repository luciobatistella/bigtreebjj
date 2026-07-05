import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const demoPerson1 = await prisma.person.create({
    data: { fullName: 'Carlos Gracie Jr.', nicknames: ['Carlos Jr.'], country: 'Brazil', city: 'Rio de Janeiro' }
  });

  const demoPerson2 = await prisma.person.create({
    data: { fullName: 'Jean Jacques Machado', nicknames: ['Jean Machado'], country: 'United States', city: 'Los Angeles' }
  });

  const demoPerson3 = await prisma.person.create({
    data: { fullName: 'Eddie Bravo', nicknames: ['Eddie'], country: 'United States', city: 'Los Angeles' }
  });

  const demoPerson4 = await prisma.person.create({
    data: { fullName: 'Fabio Gurgel', country: 'Brazil', city: 'São Paulo' }
  });

  const demoPerson5 = await prisma.person.create({
    data: { fullName: 'Demian Maia', country: 'Brazil', city: 'Belo Horizonte' }
  });

  const demoOrg = await prisma.organization.create({
    data: { name: '10th Planet Jiu-Jitsu', type: 'team' }
  });

  await prisma.lineageClaim.createMany({
    data: [
      {
        studentPersonId: demoPerson2.id,
        teacherPersonId: demoPerson1.id,
        claimType: 'black_belt_awarded_by',
        relationshipLabel: 'Black belt awarded by',
        status: 'draft',
        evidenceLevel: 'community_submission',
        confidenceScore: 0.35,
        notes: 'Demo data only. Not editorially verified.'
      },
      {
        studentPersonId: demoPerson3.id,
        teacherPersonId: demoPerson2.id,
        claimType: 'black_belt_awarded_by',
        relationshipLabel: 'Black belt awarded by',
        status: 'draft',
        evidenceLevel: 'community_submission',
        confidenceScore: 0.35,
        notes: 'Demo data only. Not editorially verified.'
      },
      {
        studentPersonId: demoPerson3.id,
        teacherPersonId: null as any,
        claimType: 'team_founder',
        relationshipLabel: 'Team founder',
        status: 'draft',
        evidenceLevel: 'community_submission',
        confidenceScore: 0.35,
        notes: 'Demo data only. Not editorially verified.'
      },
      {
        studentPersonId: demoPerson5.id,
        teacherPersonId: demoPerson4.id,
        claimType: 'black_belt_awarded_by',
        relationshipLabel: 'Black belt awarded by',
        status: 'draft',
        evidenceLevel: 'community_submission',
        confidenceScore: 0.35,
        notes: 'Demo data only. Not editorially verified.'
      }
    ]
  });

  await prisma.source.createMany({
    data: [
      {
        name: 'Sample technical source',
        url: 'https://example.com/sample-source',
        sourceType: 'sample_data',
        curatorNotes: 'Fake source reserved for technical demo only.'
      }
    ]
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
