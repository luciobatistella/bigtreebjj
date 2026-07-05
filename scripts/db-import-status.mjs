import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [jobs, people, organizations, pendingClaims, confirmedClaims, duplicates, reviewQueue] = await Promise.all([
    prisma.importJob.findMany(),
    prisma.person.count(),
    prisma.organization.count(),
    prisma.lineageClaim.count({ where: { status: 'pending_review' } }),
    prisma.lineageClaim.count({ where: { status: 'confirmed' } }),
    prisma.duplicateCandidate.count({ where: { status: 'open' } }),
    prisma.reviewQueue.count()
  ]);

  const byStatus = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    importJobCountsByStatus: byStatus,
    peopleImported: people,
    organizationsImported: organizations,
    claimsPendingReview: pendingClaims,
    claimsConfirmed: confirmedClaims,
    duplicateCandidatesOpen: duplicates,
    reviewQueueTotals: reviewQueue
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
