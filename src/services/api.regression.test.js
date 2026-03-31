import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from './supabase';
import { getWeekKey } from '../utils/weekKey';
import {
  getPastAndFuturePlanDays,
  matchActivitiesToWorkouts,
  normalizePlanWeekMetadata,
  normalizeWeeklyPlanBlockOrder,
  normalizeWorkoutBlockOrder,
  regenerateDayWorkout
} from './api';

describe('matchActivitiesToWorkouts', () => {
  it('uses canonical week key plus start_date_local for stable matching', () => {
    const weeklyPlan = {
      _weekStartDate: '2026-03-23',
      monday: null,
      tuesday: null,
      wednesday: null,
      thursday: {
        title: 'Tempo',
        type: 'speed',
        blocks: []
      },
      friday: null,
      saturday: null,
      sunday: null
    };

    const activities = [
      {
        id: 1,
        type: 'Run',
        // UTC date spills to next day in some timezones.
        start_date: '2026-03-27T00:15:00.000Z',
        // Local activity date remains Thursday and should be used for matching.
        start_date_local: '2026-03-26T17:15:00'
      }
    ];

    const matches = matchActivitiesToWorkouts(activities, weeklyPlan);
    expect(matches.thursday?.matchedActivityIds).toEqual([1]);
  });
});

describe('regenerateDayWorkout persistence metadata', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('openai_api_key', 'test-key');
  });

  it('writes _updatedAt and _weekStartDate on regenerated plans', async () => {
    const setSpy = vi.spyOn(dataService, 'set').mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Updated Workout',
                type: 'easy',
                blocks: [
                  {
                    title: 'Easy Run',
                    distance: '4 mi',
                    pace: '9:20-9:50 /mi',
                    duration: 36,
                    heartRateZone: 'Zone 2 (130-145 bpm)',
                    notes: 'Relaxed effort, smooth stride.',
                    restInterval: null
                  }
                ]
              })
            }
          }
        ]
      })
    });

    const currentWeekPlan = {
      _weekStartDate: '2026-03-23',
      monday: null,
      tuesday: { title: 'Old Workout', type: 'easy', blocks: [] },
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null
    };

    const result = await regenerateDayWorkout(
      'tuesday',
      currentWeekPlan,
      {},
      'Coach prompt',
      'Training context'
    );

    expect(result._updatedAt).toBeTruthy();
    expect(result._weekStartDate).toBe('2026-03-23');

    const weekKey = getWeekKey(new Date());
    expect(setSpy).toHaveBeenCalledWith(
      `weekly_plan_${weekKey}`,
      expect.any(String)
    );

    fetchSpy.mockRestore();
    setSpy.mockRestore();
  });
});

describe('normalizePlanWeekMetadata', () => {
  it('drops stale week-scoped metadata when week key changes', () => {
    const plan = {
      _weekStartDate: '2026-03-23',
      _activityMatches: {
        tuesday: {
          matchedActivityIds: [111]
        }
      },
      _postponements: {
        monday: {
          postponed: true
        }
      },
      monday: null,
      tuesday: { title: 'Easy', type: 'easy', blocks: [] }
    };

    const { plan: normalized, changed, hadWeekMismatch } = normalizePlanWeekMetadata(plan, '2026-03-30');

    expect(changed).toBe(true);
    expect(hadWeekMismatch).toBe(true);
    expect(normalized._weekStartDate).toBe('2026-03-30');
    expect(normalized._activityMatches).toBeUndefined();
    expect(normalized._postponements).toBeUndefined();
    expect(normalized.tuesday?.title).toBe('Easy');
  });
});

describe('getPastAndFuturePlanDays', () => {
  it('classifies Monday correctly with Monday-first day order', () => {
    const monday = new Date('2026-03-30T12:00:00');
    const { pastDays, futureDays } = getPastAndFuturePlanDays(monday);

    expect(pastDays).toEqual([]);
    expect(futureDays).toEqual([
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    ]);
  });
});

describe('block order normalization', () => {
  it('reorders a workout to warm-up, main, cool-down sequence', () => {
    const workout = {
      title: 'Speed Work',
      type: 'speed',
      blocks: [
        { title: 'Cool-down jog', notes: 'Easy finish' },
        { title: 'Main set 4x400m', notes: 'Hard efforts' },
        { title: 'Warm-up', notes: 'Easy jog + drills' }
      ]
    };

    const normalized = normalizeWorkoutBlockOrder(workout);
    expect(normalized.blocks.map((block) => block.title)).toEqual([
      'Warm-up',
      'Main set 4x400m',
      'Cool-down jog'
    ]);
  });

  it('reorders all workout days in a weekly plan', () => {
    const plan = {
      monday: null,
      tuesday: {
        title: 'Easy Run',
        type: 'easy',
        blocks: [
          { title: 'Cool-down' },
          { title: 'Main easy miles' },
          { title: 'Warm-up' }
        ]
      },
      wednesday: null,
      thursday: null,
      friday: null,
      saturday: null,
      sunday: null
    };

    const normalizedPlan = normalizeWeeklyPlanBlockOrder(plan);
    expect(normalizedPlan.tuesday.blocks.map((block) => block.title)).toEqual([
      'Warm-up',
      'Main easy miles',
      'Cool-down'
    ]);
  });
});
