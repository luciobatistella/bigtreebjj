import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [pendingClaims, confirmedClaims, duplicateCandidates, reviewQueue] = await Promise.all([
    prisma.lineageClaim.findMany({ where: { status: 'pending_review' }, take: 10 }),
    prisma.lineageClaim.findMany({ where: { status: 'confirmed' }, take: 10 }),
    prisma.duplicateCandidate.findMany({ where: { status: 'open' }, take: 10 }),
    prisma.reviewQueue.findMany({ take: 10 })
  ]);

  console.log(JSON.stringify({
    pendingClaims: pendingClaims.map((claim) => ({ id: claim.id, status: claim.status, claimType: claim.claimType })),
    confirmedClaims: confirmedClaims.map((claim) => ({ id: claim.id, status: claim.status, claimType: claim.claimType })),
    duplicateCandidates: duplicateCandidates.map((candidate) => ({ id: candidate.id, entityName: candidate.entityName, status: candidate.status })),
    reviewQueue: reviewQueue.map((entry) => ({ id: entry.id, entityType: entry.entityType, status: entry.status }))
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
