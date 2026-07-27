export const PUBLIC_FOREST_STATUSES = ['confirmed', 'corroborated', 'verified'] as const;

export function publicTreeMembershipWhere() {
  return {
    OR: [
      {
        studentClaims: {
          some: {
            status: { in: [...PUBLIC_FOREST_STATUSES] },
            teacherPersonId: { not: null }
          }
        }
      },
      {
        teacherClaims: {
          some: {
            status: { in: [...PUBLIC_FOREST_STATUSES] }
          }
        }
      }
    ]
  };
}

export async function resolvePublicTreePeople(db: any, personIds: string[]) {
  if (!personIds.length) return [];
  return db.person.findMany({
    where: {
      id: { in: personIds },
      ...publicTreeMembershipWhere()
    },
    select: {
      id: true,
      fullName: true,
      team: true,
      city: true,
      country: true
    }
  });
}
