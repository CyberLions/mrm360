export type SemesterSeason = 'SPRING' | 'FALL';

export interface SemesterAssignment {
  semester: string;
  season: SemesterSeason;
  year: number;
  startsAt: Date;
  endsAt: Date;
}

/**
 * Assign a date to the club semester that owns it. June and July are treated
 * as the upcoming fall semester so newly-created records never lack a term.
 */
export function inferSemester(date: Date = new Date()): SemesterAssignment {
  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot infer semester from an invalid date');
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const season: SemesterSeason = month >= 8 ? 'FALL' : month <= 5 ? 'SPRING' : 'FALL';

  return season === 'FALL'
    ? {
        semester: `FALL_${year}`,
        season,
        year,
        startsAt: new Date(Date.UTC(year, 7, 1)),
        endsAt: new Date(Date.UTC(year + 1, 0, 1)),
      }
    : {
        semester: `SPRING_${year}`,
        season,
        year,
        startsAt: new Date(Date.UTC(year, 0, 1)),
        endsAt: new Date(Date.UTC(year, 5, 1)),
      };
}

export function isValidSemester(value: string): boolean {
  return /^(SPRING|FALL)_\d{4}$/.test(value);
}

