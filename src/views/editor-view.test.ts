import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TIMING, SEARCH_LIMITS, UI_CONFIG } from '../constants';

/**
 * Tests for VCalc Editor View utility functions.
 *
 * Note: The editor view class itself is tightly coupled to Obsidian's API
 * and CodeMirror, making full integration testing difficult in isolation.
 * These tests cover the isolated logic and utility functions.
 */

describe('VCalcEditorView Utilities', () => {
  describe('Execution Time Formatting', () => {
    // Test the formatting logic used in updateExecutionStatus
    const formatExecutionTime = (ms: number): string => {
      if (ms < TIMING.MS_SECONDS_THRESHOLD) {
        return `${ms}ms`;
      }
      return `${(ms / TIMING.MS_SECONDS_THRESHOLD).toFixed(2)}s`;
    };

    it('should format milliseconds correctly', () => {
      expect(formatExecutionTime(100)).toBe('100ms');
      expect(formatExecutionTime(500)).toBe('500ms');
      expect(formatExecutionTime(999)).toBe('999ms');
    });

    it('should format seconds correctly', () => {
      expect(formatExecutionTime(1000)).toBe('1.00s');
      expect(formatExecutionTime(1500)).toBe('1.50s');
      expect(formatExecutionTime(2340)).toBe('2.34s');
    });

    it('should handle edge cases', () => {
      expect(formatExecutionTime(0)).toBe('0ms');
      expect(formatExecutionTime(1)).toBe('1ms');
      expect(formatExecutionTime(10000)).toBe('10.00s');
    });
  });

  describe('Variable Count Text Formatting', () => {
    const formatVariableCount = (count: number): string => {
      return count === 1 ? '1 variable' : `${count} variables`;
    };

    it('should use singular form for 1 variable', () => {
      expect(formatVariableCount(1)).toBe('1 variable');
    });

    it('should use plural form for other counts', () => {
      expect(formatVariableCount(0)).toBe('0 variables');
      expect(formatVariableCount(2)).toBe('2 variables');
      expect(formatVariableCount(10)).toBe('10 variables');
    });
  });

  describe('Error Message Truncation', () => {
    const truncateErrorMessage = (message: string, maxLength: number = UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH): string => {
      if (message.length > maxLength) {
        return message.substring(0, UI_CONFIG.ERROR_MESSAGE_TRUNCATE_TO) + '...';
      }
      return message;
    };

    it('should not truncate short messages', () => {
      expect(truncateErrorMessage('Short error')).toBe('Short error');
      expect(truncateErrorMessage('A'.repeat(UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH))).toBe('A'.repeat(UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH));
    });

    it('should truncate long messages', () => {
      const longMessage = 'A'.repeat(60);
      const result = truncateErrorMessage(longMessage);
      expect(result.length).toBe(UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should handle empty message', () => {
      expect(truncateErrorMessage('')).toBe('');
    });
  });

  describe('Status Message Building', () => {
    const buildSuccessStatus = (timeStr: string, varText: string): string => {
      return `✓ Executed in ${timeStr} • ${varText}`;
    };

    const buildErrorStatus = (shortError: string): string => {
      return `✗ Error: ${shortError}`;
    };

    it('should build success status correctly', () => {
      expect(buildSuccessStatus('150ms', '3 variables'))
        .toBe('✓ Executed in 150ms • 3 variables');
      expect(buildSuccessStatus('2.50s', '1 variable'))
        .toBe('✓ Executed in 2.50s • 1 variable');
    });

    it('should build error status correctly', () => {
      expect(buildErrorStatus('NameError: x is not defined'))
        .toBe('✗ Error: NameError: x is not defined');
      expect(buildErrorStatus('Execution failed'))
        .toBe('✗ Error: Execution failed');
    });
  });

  describe('Block Title Update Logic', () => {
    // Test the regex pattern used to find vcalc callouts
    const vcalcCalloutPattern = /^>\s*\[!vcalc\]\s*(.*)/i;

    it('should match vcalc callout lines', () => {
      expect(vcalcCalloutPattern.test('> [!vcalc] My Block')).toBe(true);
      expect(vcalcCalloutPattern.test('> [!vcalc]')).toBe(true);
      expect(vcalcCalloutPattern.test('> [!VCALC] Title')).toBe(true);
      expect(vcalcCalloutPattern.test('>  [!vcalc] Title')).toBe(true);
    });

    it('should not match non-vcalc callouts', () => {
      expect(vcalcCalloutPattern.test('> [!note] Title')).toBe(false);
      expect(vcalcCalloutPattern.test('[!vcalc] Title')).toBe(false);
      expect(vcalcCalloutPattern.test('> [!vcalcx] Title')).toBe(false);
    });

    it('should capture the title', () => {
      const match = '> [!vcalc] My Block Title'.match(vcalcCalloutPattern);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('My Block Title');
    });

    it('should handle empty title', () => {
      const match = '> [!vcalc]'.match(vcalcCalloutPattern);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('');
    });
  });

  describe('Block ID Search Logic', () => {
    const findBlockIdInLines = (lines: string[], startIndex: number, id: string, maxLookahead: number = SEARCH_LIMITS.BLOCK_ID_LOOKAHEAD): boolean => {
      for (let j = startIndex + 1; j < lines.length && j < startIndex + maxLookahead; j++) {
        if (lines[j].includes(`id=${id}`)) {
          return true;
        }
        if (!lines[j].startsWith('>')) break;
      }
      return false;
    };

    it('should find ID in code block options', () => {
      const lines = [
        '> [!vcalc] My Block',
        '> ```python',
        '> # vcalc: id=abc123',
        '> x = 5',
        '> ```'
      ];
      expect(findBlockIdInLines(lines, 0, 'abc123')).toBe(true);
    });

    it('should not find non-existent ID', () => {
      const lines = [
        '> [!vcalc] My Block',
        '> ```python',
        '> # vcalc: id=other',
        '> x = 5',
        '> ```'
      ];
      expect(findBlockIdInLines(lines, 0, 'abc123')).toBe(false);
    });

    it('should stop searching when leaving callout', () => {
      const lines = [
        '> [!vcalc] My Block',
        '> ```python',
        '> x = 5',
        '> ```',
        '',
        'id=abc123' // Outside callout
      ];
      expect(findBlockIdInLines(lines, 0, 'abc123')).toBe(false);
    });

    it('should respect maxLookahead limit', () => {
      const lines = Array(20).fill('> some line');
      lines[15] = '> # vcalc: id=abc123'; // Beyond default lookahead
      expect(findBlockIdInLines(lines, 0, 'abc123', SEARCH_LIMITS.BLOCK_ID_LOOKAHEAD)).toBe(false);
    });
  });

  describe('Error Detection Logic', () => {
    // Simulate the error detection from DOM elements
    const checkForError = (outputClasses: string[], errorElementText?: string): { hasError: boolean; errorMessage?: string } => {
      // Check for error class
      const hasErrorClass = outputClasses.some(cls =>
        cls === 'calc-error' || cls === 'error' || cls.includes('error')
      );

      if (hasErrorClass && errorElementText) {
        return {
          hasError: true,
          errorMessage: errorElementText.trim() || 'Execution error'
        };
      }

      if (hasErrorClass) {
        return { hasError: true, errorMessage: 'Execution error' };
      }

      return { hasError: false };
    };

    it('should detect error class', () => {
      expect(checkForError(['calc-error'])).toEqual({ hasError: true, errorMessage: 'Execution error' });
      expect(checkForError(['error'])).toEqual({ hasError: true, errorMessage: 'Execution error' });
      expect(checkForError(['some-error-class'])).toEqual({ hasError: true, errorMessage: 'Execution error' });
    });

    it('should include error message when available', () => {
      expect(checkForError(['calc-error'], 'NameError: x is not defined'))
        .toEqual({ hasError: true, errorMessage: 'NameError: x is not defined' });
    });

    it('should not detect error when no error class present', () => {
      expect(checkForError(['calc-output', 'math-wrapper'])).toEqual({ hasError: false });
      expect(checkForError([])).toEqual({ hasError: false });
    });
  });

  describe('CSS Class Management', () => {
    const getStatusClasses = (success: boolean): string[] => {
      const classes = ['vcalc-editor-status'];
      if (success) {
        classes.push('vcalc-status-success');
      } else {
        classes.push('vcalc-status-error');
      }
      return classes;
    };

    it('should add success class for successful execution', () => {
      const classes = getStatusClasses(true);
      expect(classes).toContain('vcalc-editor-status');
      expect(classes).toContain('vcalc-status-success');
      expect(classes).not.toContain('vcalc-status-error');
    });

    it('should add error class for failed execution', () => {
      const classes = getStatusClasses(false);
      expect(classes).toContain('vcalc-editor-status');
      expect(classes).toContain('vcalc-status-error');
      expect(classes).not.toContain('vcalc-status-success');
    });
  });
});

describe('Rename Modal Logic', () => {
  describe('Title Validation', () => {
    const validateTitle = (title: string): string | null => {
      const trimmed = title.trim();
      return trimmed || null;
    };

    it('should return trimmed title when valid', () => {
      expect(validateTitle('My Block')).toBe('My Block');
      expect(validateTitle('  Spaced Title  ')).toBe('Spaced Title');
    });

    it('should return null for empty titles', () => {
      expect(validateTitle('')).toBeNull();
      expect(validateTitle('   ')).toBeNull();
      expect(validateTitle('\t\n')).toBeNull();
    });

    it('should preserve internal spaces', () => {
      expect(validateTitle('Force  Calculation')).toBe('Force  Calculation');
    });
  });

  describe('Title Line Construction', () => {
    const buildTitleLine = (newTitle: string): string => {
      return `> [!vcalc] ${newTitle}`;
    };

    it('should construct valid title line', () => {
      expect(buildTitleLine('My Block')).toBe('> [!vcalc] My Block');
      expect(buildTitleLine('Force Calculation')).toBe('> [!vcalc] Force Calculation');
    });

    it('should handle empty title', () => {
      expect(buildTitleLine('')).toBe('> [!vcalc] ');
    });

    it('should handle special characters', () => {
      expect(buildTitleLine('Block (v2.0)')).toBe('> [!vcalc] Block (v2.0)');
      expect(buildTitleLine('Math & Physics')).toBe('> [!vcalc] Math & Physics');
    });
  });
});
