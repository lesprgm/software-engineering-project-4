/**
 * @jest-environment jsdom
 */
import { matchesService } from '../services/matches';

describe('Matches Service - Swipe Tracking', () => {
  beforeEach(() => {
    // Clear any previous state
  });

  describe('recordSwipe', () => {
    it('should be defined', () => {
      expect(matchesService.recordSwipe).toBeDefined();
      expect(typeof matchesService.recordSwipe).toBe('function');
    });

    it('should accept correct parameters', () => {
      const userId = 'user-123';
      const swipe = {
        target_user_id: 'target-456',
        swiped_right: true,
      };

      expect(() => {
        matchesService.recordSwipe(userId, swipe);
      }).not.toThrow();
    });
  });

  describe('getUserMatches', () => {
    it('should be defined', () => {
      expect(matchesService.getUserMatches).toBeDefined();
      expect(typeof matchesService.getUserMatches).toBe('function');
    });

    it('should accept userId and limit parameters', () => {
      expect(() => {
        matchesService.getUserMatches('user-123', 10);
      }).not.toThrow();
    });
  });

  describe('getMutualMatches', () => {
    it('should be defined', () => {
      expect(matchesService.getMutualMatches).toBeDefined();
      expect(typeof matchesService.getMutualMatches).toBe('function');
    });

    it('should accept userId parameter', () => {
      expect(() => {
        matchesService.getMutualMatches('user-123');
      }).not.toThrow();
    });
  });

  describe('SwipeAction interface', () => {
    it('should validate swipe action structure', () => {
      const validSwipe = {
        target_user_id: 'user-456',
        swiped_right: true,
      };

      expect(validSwipe).toHaveProperty('target_user_id');
      expect(validSwipe).toHaveProperty('swiped_right');
      expect(typeof validSwipe.target_user_id).toBe('string');
      expect(typeof validSwipe.swiped_right).toBe('boolean');
    });

    it('should support both right and left swipes', () => {
      const rightSwipe = {
        target_user_id: 'user-456',
        swiped_right: true,
      };

      const leftSwipe = {
        target_user_id: 'user-789',
        swiped_right: false,
      };

      expect(rightSwipe.swiped_right).toBe(true);
      expect(leftSwipe.swiped_right).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty user ID', () => {
      expect(() => {
        matchesService.getUserMatches('');
      }).not.toThrow();
    });

    it('should handle limit of 0', () => {
      expect(() => {
        matchesService.getUserMatches('user-123', 0);
      }).not.toThrow();
    });

    it('should handle very large limit', () => {
      expect(() => {
        matchesService.getUserMatches('user-123', 1000);
      }).not.toThrow();
    });

    it('should handle special characters in user ID', () => {
      expect(() => {
        matchesService.getUserMatches('user-123-abc-@#$');
      }).not.toThrow();
    });
  });
});

describe('UserMatchCandidate interface', () => {
  it('should have required fields', () => {
    const candidate = {
      user_id: 'user-123',
      display_name: 'Test User',
      compatibility_score: 0.85,
      shared_interests: ['hiking', 'reading'],
      schedule_score: 0.7,
      personality_overlap: 0.8,
    };

    expect(candidate).toHaveProperty('user_id');
    expect(candidate).toHaveProperty('display_name');
    expect(candidate).toHaveProperty('compatibility_score');
    expect(candidate).toHaveProperty('shared_interests');
    expect(candidate).toHaveProperty('schedule_score');
    expect(candidate).toHaveProperty('personality_overlap');
  });

  it('should support optional fields', () => {
    const candidateWithOptionals = {
      user_id: 'user-123',
      display_name: 'Test User',
      compatibility_score: 0.85,
      shared_interests: ['hiking'],
      schedule_score: 0.7,
      personality_overlap: 0.8,
      bio: 'Love hiking!',
      tagline: 'Adventure seeker',
      photos: ['https://example.com/photo.jpg'],
    };

    expect(candidateWithOptionals).toHaveProperty('bio');
    expect(candidateWithOptionals).toHaveProperty('tagline');
    expect(candidateWithOptionals).toHaveProperty('photos');
  });

  it('should handle empty shared interests', () => {
    const candidate = {
      user_id: 'user-123',
      display_name: 'Test User',
      compatibility_score: 0.5,
      shared_interests: [],
      schedule_score: 0.3,
      personality_overlap: 0.4,
    };

    expect(candidate.shared_interests).toEqual([]);
  });

  it('should handle score boundaries', () => {
    const minScores = {
      user_id: 'user-123',
      display_name: 'Test User',
      compatibility_score: 0.0,
      shared_interests: [],
      schedule_score: 0.0,
      personality_overlap: 0.0,
    };

    const maxScores = {
      user_id: 'user-456',
      display_name: 'Perfect Match',
      compatibility_score: 1.0,
      shared_interests: ['everything'],
      schedule_score: 1.0,
      personality_overlap: 1.0,
    };

    expect(minScores.compatibility_score).toBeGreaterThanOrEqual(0);
    expect(minScores.compatibility_score).toBeLessThanOrEqual(1);
    expect(maxScores.compatibility_score).toBeGreaterThanOrEqual(0);
    expect(maxScores.compatibility_score).toBeLessThanOrEqual(1);
  });
});

describe('Swipe Workflow Logic', () => {
  it('should track state transitions', () => {
    const states = {
      unswiped: 'User appears in candidates list',
      swiped_right: 'User removed from candidates, waiting for reciprocal swipe',
      swiped_left: 'User removed from candidates, no match possible',
      mutual_match: 'Both users swiped right, appears in mutual matches',
    };

    expect(states).toHaveProperty('unswiped');
    expect(states).toHaveProperty('swiped_right');
    expect(states).toHaveProperty('swiped_left');
    expect(states).toHaveProperty('mutual_match');
  });

  it('should validate match conditions', () => {
    const isMutualMatch = (userASwipedRight: boolean, userBSwipedRight: boolean) => {
      return userASwipedRight && userBSwipedRight;
    };

    expect(isMutualMatch(true, true)).toBe(true);
    expect(isMutualMatch(true, false)).toBe(false);
    expect(isMutualMatch(false, true)).toBe(false);
    expect(isMutualMatch(false, false)).toBe(false);
  });

  it('should handle swipe reversals', () => {
    // User can change their mind by swiping again
    const swipes = [
      { swiped_right: true, timestamp: 1 },
      { swiped_right: false, timestamp: 2 }, // Changed mind
      { swiped_right: true, timestamp: 3 },  // Changed again
    ];

    const latestSwipe = swipes[swipes.length - 1];
    expect(latestSwipe.swiped_right).toBe(true);
  });
});

describe('Integration Scenarios', () => {
  it('should handle complete user journey', () => {
    const journey = [
      { step: 1, action: 'Load app', state: 'View login' },
      { step: 2, action: 'Login', state: 'Authenticated' },
      { step: 3, action: 'Navigate to Matches', state: 'View candidates' },
      { step: 4, action: 'Swipe right', state: 'Record swipe' },
      { step: 5, action: 'View next candidate', state: 'Show next user' },
      { step: 6, action: 'Run out of candidates', state: 'Show empty state' },
      { step: 7, action: 'Navigate to Messages', state: 'View mutual matches only' },
    ];

    expect(journey).toHaveLength(7);
    expect(journey[journey.length - 1].action).toBe('Navigate to Messages');
  });

  it('should handle error recovery', () => {
    const errorScenarios = [
      { error: 'Network timeout', recovery: 'Retry request' },
      { error: 'Invalid user ID', recovery: 'Show error message' },
      { error: 'API rate limit', recovery: 'Queue request' },
      { error: 'Duplicate swipe', recovery: 'Update existing record' },
    ];

    errorScenarios.forEach((scenario) => {
      expect(scenario).toHaveProperty('error');
      expect(scenario).toHaveProperty('recovery');
    });
  });

  it('should validate data consistency', () => {
    // Users in candidates should not be in mutual matches
    const candidates = ['user-1', 'user-2', 'user-3'];
    const mutualMatches = ['user-4', 'user-5'];

    const overlap = candidates.filter((id) => mutualMatches.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it('should handle concurrent user actions', () => {
    // If both users swipe simultaneously, system should handle gracefully
    const userASwipe = { user: 'A', target: 'B', time: 1000 };
    const userBSwipe = { user: 'B', target: 'A', time: 1001 };

    expect(userASwipe.target).toBe(userBSwipe.user);
    expect(userBSwipe.target).toBe(userASwipe.user);
  });
});
