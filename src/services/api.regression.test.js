import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from './supabase';
import { getWeekKey } from '../utils/weekKey';
import { matchActivitiesToWorkouts, regenerateDayWorkout } from './api';

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
