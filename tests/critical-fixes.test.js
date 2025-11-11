import { describe, it, expect } from 'vitest';
import periodizationModule from '../netlify/functions/periodization-planner.js';

const { calculatePhaseProgress, resolveProgramStartDate } = periodizationModule;

describe('calculatePhaseProgress', () => {
  it('returns week 0 when the program has not started yet', () => {
    const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const blocks = Array.from({ length: 3 }, () => ({ startDate: futureStart }));

    const progress = calculatePhaseProgress(blocks, futureStart);
    expect(progress.currentWeek).toBe(0);
    expect(progress.percentage).toBe(0);
    expect(progress.completed).toBe(false);
  });

  it('uses a ceiling calculation for in-progress programs', () => {
    const pastStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const blocks = Array.from({ length: 6 }, () => ({}));

    const progress = calculatePhaseProgress(blocks, pastStart);
    expect(progress.currentWeek).toBeGreaterThanOrEqual(2);
    expect(progress.totalWeeks).toBe(24);
  });

  it('never exceeds the total number of weeks', () => {
    const pastStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(); // far in the past
    const blocks = Array.from({ length: 2 }, () => ({})); // 8 weeks total

    const progress = calculatePhaseProgress(blocks, pastStart);
    expect(progress.currentWeek).toBe(8);
    expect(progress.completed).toBe(true);
  });
});

describe('resolveProgramStartDate', () => {
  it('prefers the earliest valid candidate date', () => {
    const resolved = resolveProgramStartDate({
      programStartDate: '2024-04-10',
      training_start_date: 'invalid-date',
      user_profile: {
        program_start_date: '2024-03-05',
      },
      preferences: {
        program_start_date: '2024-05-01',
      },
    });

    expect(resolved).toBeInstanceOf(Date);
    expect(resolved.toISOString().startsWith('2024-03-05')).toBe(true);
  });

  it('returns null when no valid date is available', () => {
    const resolved = resolveProgramStartDate({
      programStartDate: undefined,
      training_start_date: null,
    });

    expect(resolved).toBeNull();
  });
});
