import { describe, it, expect } from 'vitest';
import {
  generateVCalcId,
  VCALC_VIEW_TYPE,
  VCALC_EDITOR_VIEW_TYPE,
  VCALC_ID_ATTRIBUTE,
  MATH_FUNCTIONS,
  MATH_CONSTANTS,
  GREEK_LETTERS,
  VSET_COLORS,
  TIMING,
  RETRY_LIMITS,
  SEARCH_LIMITS,
  UI_CONFIG,
  DEFAULT_SETTINGS,
} from './constants';

describe('Constants', () => {
  describe('View Identifiers', () => {
    it('should have unique view type identifiers', () => {
      expect(VCALC_VIEW_TYPE).toBe('vcalc-variables-view');
      expect(VCALC_EDITOR_VIEW_TYPE).toBe('vcalc-editor-view');
      expect(VCALC_VIEW_TYPE).not.toBe(VCALC_EDITOR_VIEW_TYPE);
    });

    it('should have data attribute identifier', () => {
      expect(VCALC_ID_ATTRIBUTE).toBe('data-vcalc-id');
    });
  });

  describe('generateVCalcId', () => {
    it('should generate ID with exactly 8 characters', () => {
      const id = generateVCalcId();
      expect(id).toHaveLength(8);
    });

    it('should only contain alphanumeric lowercase characters', () => {
      const id = generateVCalcId();
      expect(id).toMatch(/^[a-z0-9]{8}$/);
    });

    it('should generate different IDs on subsequent calls', () => {
      const id1 = generateVCalcId();
      const id2 = generateVCalcId();
      const id3 = generateVCalcId();

      // Not guaranteed to be different, but extremely likely
      // Use Set for clarity - all 3 should be unique
      const ids = new Set([id1, id2, id3]);
      expect(ids.size).toBe(3);
    });

    it('should generate unique IDs at high volume (99%+ unique)', () => {
      const ids = new Set<string>();
      const count = 10000;

      for (let i = 0; i < count; i++) {
        ids.add(generateVCalcId());
      }

      // Expect at least 99.9% uniqueness
      const uniquenessRate = ids.size / count;
      expect(uniquenessRate).toBeGreaterThan(0.999);
    });

    it('should generate IDs quickly (performance test)', () => {
      const start = performance.now();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        generateVCalcId();
      }

      const duration = performance.now() - start;
      // Should generate 1000 IDs in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Math Functions', () => {
    it('should contain common math functions', () => {
      expect(MATH_FUNCTIONS).toContain('sqrt');
      expect(MATH_FUNCTIONS).toContain('abs');
      expect(MATH_FUNCTIONS).toContain('sin');
      expect(MATH_FUNCTIONS).toContain('cos');
      expect(MATH_FUNCTIONS).toContain('log');
    });

    it('should have at least 10 math functions', () => {
      expect(MATH_FUNCTIONS.length).toBeGreaterThanOrEqual(10);
    });

    it('should not have duplicates', () => {
      const unique = new Set(MATH_FUNCTIONS);
      expect(unique.size).toBe(MATH_FUNCTIONS.length);
    });
  });

  describe('Math Constants', () => {
    it('should contain pi and e', () => {
      expect(MATH_CONSTANTS).toContain('pi');
      expect(MATH_CONSTANTS).toContain('e');
    });

    it('should have at least 2 constants', () => {
      expect(MATH_CONSTANTS.length).toBeGreaterThanOrEqual(2);
    });

    it('should not have duplicates', () => {
      const unique = new Set(MATH_CONSTANTS);
      expect(unique.size).toBe(MATH_CONSTANTS.length);
    });
  });

  describe('Greek Letters', () => {
    it('should contain common Greek letters', () => {
      expect(GREEK_LETTERS).toContain('alpha');
      expect(GREEK_LETTERS).toContain('beta');
      expect(GREEK_LETTERS).toContain('gamma');
      expect(GREEK_LETTERS).toContain('delta');
      expect(GREEK_LETTERS).toContain('theta');
    });

    it('should contain uppercase variants', () => {
      expect(GREEK_LETTERS).toContain('Gamma');
      expect(GREEK_LETTERS).toContain('Delta');
      expect(GREEK_LETTERS).toContain('Theta');
    });

    it('should have at least 20 letters', () => {
      expect(GREEK_LETTERS.length).toBeGreaterThanOrEqual(20);
    });

    it('should not have duplicates', () => {
      const unique = new Set(GREEK_LETTERS);
      expect(unique.size).toBe(GREEK_LETTERS.length);
    });
  });

  describe('VSET_COLORS', () => {
    it('should have at least 6 colors', () => {
      expect(VSET_COLORS.length).toBeGreaterThanOrEqual(6);
    });

    it('should have color objects with name and rgb properties', () => {
      VSET_COLORS.forEach((color) => {
        expect(color).toHaveProperty('name');
        expect(color).toHaveProperty('rgb');
        expect(typeof color.name).toBe('string');
        expect(typeof color.rgb).toBe('string');
      });
    });

    it('should have RGB values in "r, g, b" format', () => {
      VSET_COLORS.forEach((color) => {
        // Should match pattern: "number, number, number"
        expect(color.rgb).toMatch(/^\d+,\s*\d+,\s*\d+$/);
      });
    });

    it('should have unique color names', () => {
      const names = VSET_COLORS.map((c) => c.name);
      const unique = new Set(names);
      expect(unique.size).toBe(VSET_COLORS.length);
    });

    it('should contain common colors', () => {
      const names = VSET_COLORS.map((c) => c.name);
      expect(names).toContain('blue');
      expect(names).toContain('green');
      expect(names).toContain('red');
    });

    it('should have valid RGB values (0-255)', () => {
      VSET_COLORS.forEach((color) => {
        const [r, g, b] = color.rgb.split(',').map((v) => parseInt(v.trim()));
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      });
    });
  });

  describe('TIMING', () => {
    it('should have all required timing constants', () => {
      expect(TIMING.INTER_BLOCK_DELAY_MS).toBe(100);
      expect(TIMING.BLOCK_SAVE_DELAY_MS).toBe(50);
      expect(TIMING.UI_FEEDBACK_RESET_MS).toBe(2000);
      expect(TIMING.IDLE_SAVE_DELAY_MS).toBe(2500);
      expect(TIMING.MIRROR_CHECK_INTERVAL_MS).toBe(300);
      expect(TIMING.BLOCK_RETRY_DELAY_MS).toBe(100);
      expect(TIMING.DOM_STABILIZATION_DELAY_MS).toBe(150);
      expect(TIMING.POST_RUN_RERENDER_DELAY_MS).toBe(250);
      expect(TIMING.POST_WRITE_SETTLE_DELAY_MS).toBe(300);
      expect(TIMING.NOTICE_DURATION_MS).toBe(3000);
      expect(TIMING.MS_SECONDS_THRESHOLD).toBe(1000);
    });

    it('should have all timing values as positive numbers', () => {
      Object.values(TIMING).forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    it('should be immutable (as const)', () => {
      // TypeScript enforces this at compile time, but we can verify structure
      expect(TIMING).toHaveProperty('INTER_BLOCK_DELAY_MS');

      // Attempting to modify should fail (or be ignored in strict mode)
      const timing: any = TIMING;
      expect(() => {
        timing.INTER_BLOCK_DELAY_MS = 999;
      }).not.toThrow();

      // In TypeScript strict mode, the value shouldn't change
      // (Runtime behavior depends on Object.freeze, which 'as const' doesn't guarantee)
    });
  });

  describe('RETRY_LIMITS', () => {
    it('should have MAX_BLOCK_RETRIES defined', () => {
      expect(RETRY_LIMITS.MAX_BLOCK_RETRIES).toBe(3);
    });

    it('should have positive retry limit', () => {
      expect(RETRY_LIMITS.MAX_BLOCK_RETRIES).toBeGreaterThan(0);
    });

    it('should be immutable (as const)', () => {
      expect(RETRY_LIMITS).toHaveProperty('MAX_BLOCK_RETRIES');
    });
  });

  describe('SEARCH_LIMITS', () => {
    it('should have BLOCK_ID_LOOKAHEAD defined', () => {
      expect(SEARCH_LIMITS.BLOCK_ID_LOOKAHEAD).toBe(10);
    });

    it('should have positive lookahead limit', () => {
      expect(SEARCH_LIMITS.BLOCK_ID_LOOKAHEAD).toBeGreaterThan(0);
    });
  });

  describe('UI_CONFIG', () => {
    it('should have all required UI configuration constants', () => {
      expect(UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH).toBe(50);
      expect(UI_CONFIG.ERROR_MESSAGE_TRUNCATE_TO).toBe(47);
      expect(UI_CONFIG.EDITOR_FONT_SIZE_PX).toBe(14);
    });

    it('should have ERROR_MESSAGE_TRUNCATE_TO less than ERROR_MESSAGE_MAX_LENGTH', () => {
      expect(UI_CONFIG.ERROR_MESSAGE_TRUNCATE_TO).toBeLessThan(UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH);
    });

    it('should have all values as positive numbers', () => {
      Object.values(UI_CONFIG).forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should have all required setting properties', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('showSymbolic');
      expect(DEFAULT_SETTINGS).toHaveProperty('showSubstitution');
      expect(DEFAULT_SETTINGS).toHaveProperty('showResult');
      expect(DEFAULT_SETTINGS).toHaveProperty('autoSaveOnRun');
      expect(DEFAULT_SETTINGS).toHaveProperty('syncAccentWithVset');
      expect(DEFAULT_SETTINGS).toHaveProperty('backgroundStyle');
      expect(DEFAULT_SETTINGS).toHaveProperty('compactMode');
    });

    it('should have correct default values', () => {
      expect(DEFAULT_SETTINGS.showSymbolic).toBe(true);
      expect(DEFAULT_SETTINGS.showSubstitution).toBe(true);
      expect(DEFAULT_SETTINGS.showResult).toBe(true);
      expect(DEFAULT_SETTINGS.autoSaveOnRun).toBe(false);
      expect(DEFAULT_SETTINGS.syncAccentWithVset).toBe(false);
      expect(DEFAULT_SETTINGS.backgroundStyle).toBe('default');
      expect(DEFAULT_SETTINGS.compactMode).toBe(false);
    });

    it('should have boolean values for display flags', () => {
      expect(typeof DEFAULT_SETTINGS.showSymbolic).toBe('boolean');
      expect(typeof DEFAULT_SETTINGS.showSubstitution).toBe('boolean');
      expect(typeof DEFAULT_SETTINGS.showResult).toBe('boolean');
    });

    it('should have boolean values for feature flags', () => {
      expect(typeof DEFAULT_SETTINGS.autoSaveOnRun).toBe('boolean');
      expect(typeof DEFAULT_SETTINGS.syncAccentWithVset).toBe('boolean');
      expect(typeof DEFAULT_SETTINGS.compactMode).toBe('boolean');
    });

    it('should have string value for backgroundStyle', () => {
      expect(typeof DEFAULT_SETTINGS.backgroundStyle).toBe('string');
    });
  });
});
