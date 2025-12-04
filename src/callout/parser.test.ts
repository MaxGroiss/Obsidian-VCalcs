import { describe, it, expect, beforeEach } from 'vitest';
import { parseVsetFromCodeBlock, getCalloutTitle, buildOptionsLine } from './parser';
import { createMockCallout, createMockCalloutWithOptions } from '../../tests/mocks/dom';

describe('Parser', () => {
  describe('parseVsetFromCodeBlock', () => {
    it('should parse minimal code block with no options', () => {
      const callout = createMockCallout('x = 5\ny = 10');
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBeNull();
      expect(result.code).toBe('x = 5\ny = 10');
      expect(result.vset).toBeNull();
      expect(result.hidden).toBe(false);
      expect(result.accentVset).toBeNull();
      expect(result.bgStyle).toBeNull();
      expect(result.compact).toBeNull();
    });

    it('should parse code block with all options', () => {
      const callout = createMockCalloutWithOptions('x = 5\ny = 10', {
        id: 'abc123',
        vset: 'main',
        hidden: true,
        accent: 'vset',
        bg: 'transparent',
        compact: true,
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBe('abc123');
      expect(result.code).toBe('x = 5\ny = 10');
      expect(result.vset).toBe('main');
      expect(result.hidden).toBe(true);
      expect(result.accentVset).toBe(true);
      expect(result.bgStyle).toBe('transparent');
      expect(result.compact).toBe(true);
    });

    it('should parse code block with only id', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        id: 'test123',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBe('test123');
      expect(result.code).toBe('x = 5');
      expect(result.vset).toBeNull();
      expect(result.hidden).toBe(false);
    });

    it('should parse code block with only vset', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        vset: 'physics',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBeNull();
      expect(result.vset).toBe('physics');
      expect(result.code).toBe('x = 5');
    });

    it('should parse hidden flag', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        hidden: true,
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.hidden).toBe(true);
    });

    it('should parse accent=vset', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        accent: 'vset',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.accentVset).toBe(true);
    });

    it('should parse accent=default', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        accent: 'default',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.accentVset).toBe(false);
    });

    it('should parse bg styles', () => {
      const styles = ['transparent', 'subtle', 'solid'];

      styles.forEach((style) => {
        const callout = createMockCalloutWithOptions('x = 5', {
          bg: style,
        });
        const result = parseVsetFromCodeBlock(callout);
        expect(result.bgStyle).toBe(style);
      });
    });

    it('should parse compact flag', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        compact: true,
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.compact).toBe(true);
    });

    it('should handle callout without code block', () => {
      const callout = document.createElement('div');
      callout.className = 'callout';

      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBeNull();
      expect(result.code).toBe('');
      expect(result.vset).toBeNull();
      expect(result.hidden).toBe(false);
    });

    it('should handle empty code block', () => {
      const callout = createMockCallout('');
      const result = parseVsetFromCodeBlock(callout);

      expect(result.code).toBe('');
    });

    it('should handle code block with only options line', () => {
      const callout = createMockCalloutWithOptions('', {
        id: 'test123',
        vset: 'main',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBe('test123');
      expect(result.vset).toBe('main');
      expect(result.code).toBe('');
    });

    it('should handle whitespace in options', () => {
      const callout = createMockCallout('# vcalc:   id=test123   vset=main   hidden  \nx = 5');
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBe('test123');
      expect(result.vset).toBe('main');
      expect(result.hidden).toBe(true);
      expect(result.code).toBe('x = 5');
    });

    it('should handle multiline code after options', () => {
      const callout = createMockCalloutWithOptions('x = 5\ny = 10\nz = x + y', {
        id: 'test123',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.code).toBe('x = 5\ny = 10\nz = x + y');
    });

    it('should preserve empty lines in code', () => {
      const callout = createMockCalloutWithOptions('x = 5\n\ny = 10', {
        id: 'test123',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.code).toBe('x = 5\n\ny = 10');
    });

    it('should handle code without options line', () => {
      const callout = createMockCallout('# This is a comment\nx = 5');
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBeNull();
      expect(result.code).toBe('# This is a comment\nx = 5');
    });

    it('should handle alphanumeric id values', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        id: 'abc123def',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBe('abc123def');
    });

    it('should handle alphanumeric vset names', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        vset: 'physics2024',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.vset).toBe('physics2024');
    });

    it('should handle case-sensitive vset names', () => {
      const callout = createMockCalloutWithOptions('x = 5', {
        vset: 'MyVSet',
      });
      const result = parseVsetFromCodeBlock(callout);

      expect(result.vset).toBe('MyVSet');
    });

    it('should ignore invalid accent values', () => {
      const callout = createMockCallout('# vcalc: accent=invalid\nx = 5');
      const result = parseVsetFromCodeBlock(callout);

      // Should parse but accentVset should be false (not 'vset')
      expect(result.accentVset).toBe(false);
    });

    it('should handle options in any order', () => {
      const callout = createMockCallout('# vcalc: compact hidden vset=main id=test123 bg=solid\nx = 5');
      const result = parseVsetFromCodeBlock(callout);

      expect(result.id).toBe('test123');
      expect(result.vset).toBe('main');
      expect(result.hidden).toBe(true);
      expect(result.bgStyle).toBe('solid');
      expect(result.compact).toBe(true);
      expect(result.code).toBe('x = 5');
    });
  });

  describe('getCalloutTitle', () => {
    it('should extract title from callout', () => {
      const callout = createMockCallout('x = 5');
      const title = getCalloutTitle(callout);

      expect(title).toBe('VCalc');
    });

    it('should return default title when title element missing', () => {
      const callout = document.createElement('div');
      callout.className = 'callout';

      const title = getCalloutTitle(callout);

      expect(title).toBe('Calculation');
    });

    it('should return default title when title is empty', () => {
      const callout = document.createElement('div');
      callout.className = 'callout';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'callout-title';
      const titleInner = document.createElement('div');
      titleInner.className = 'callout-title-inner';
      titleInner.textContent = '';
      titleDiv.appendChild(titleInner);
      callout.appendChild(titleDiv);

      const title = getCalloutTitle(callout);

      expect(title).toBe('Calculation');
    });

    it('should handle custom title', () => {
      const callout = document.createElement('div');
      callout.className = 'callout';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'callout-title';
      const titleInner = document.createElement('div');
      titleInner.className = 'callout-title-inner';
      titleInner.textContent = 'My Custom Title';
      titleDiv.appendChild(titleInner);
      callout.appendChild(titleDiv);

      const title = getCalloutTitle(callout);

      expect(title).toBe('My Custom Title');
    });

    it('should handle title with special characters', () => {
      const callout = document.createElement('div');
      callout.className = 'callout';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'callout-title';
      const titleInner = document.createElement('div');
      titleInner.className = 'callout-title-inner';
      titleInner.textContent = 'Physics: Force & Motion';
      titleDiv.appendChild(titleInner);
      callout.appendChild(titleDiv);

      const title = getCalloutTitle(callout);

      expect(title).toBe('Physics: Force & Motion');
    });
  });

  describe('buildOptionsLine', () => {
    it('should build minimal options line with only id', () => {
      const line = buildOptionsLine({ id: 'abc123' });
      expect(line).toBe('# vcalc: id=abc123');
    });

    it('should build options line with all options', () => {
      const line = buildOptionsLine({
        id: 'abc123',
        vset: 'main',
        hidden: true,
        accentVset: true,
        bgStyle: 'transparent',
        compact: true,
      });

      expect(line).toContain('id=abc123');
      expect(line).toContain('vset=main');
      expect(line).toContain('hidden');
      expect(line).toContain('accent=vset');
      expect(line).toContain('bg=transparent');
      expect(line).toContain('compact');
      expect(line).toMatch(/^# vcalc: /);
    });

    it('should build options line with id and vset', () => {
      const line = buildOptionsLine({
        id: 'test123',
        vset: 'physics',
      });

      expect(line).toBe('# vcalc: id=test123 vset=physics');
    });

    it('should handle accent=default', () => {
      const line = buildOptionsLine({
        id: 'test123',
        accentVset: false,
      });

      expect(line).toContain('accent=default');
    });

    it('should handle accent=vset', () => {
      const line = buildOptionsLine({
        id: 'test123',
        accentVset: true,
      });

      expect(line).toContain('accent=vset');
    });

    it('should omit null/undefined options', () => {
      const line = buildOptionsLine({
        id: 'test123',
        vset: null,
        hidden: false,
        accentVset: null,
        bgStyle: null,
        compact: false,
      });

      expect(line).toBe('# vcalc: id=test123');
      expect(line).not.toContain('vset=');
      expect(line).not.toContain('hidden');
      expect(line).not.toContain('accent=');
      expect(line).not.toContain('bg=');
      expect(line).not.toContain('compact');
    });

    it('should handle different bg styles', () => {
      const styles = ['transparent', 'subtle', 'solid'];

      styles.forEach((style) => {
        const line = buildOptionsLine({
          id: 'test123',
          bgStyle: style,
        });
        expect(line).toContain(`bg=${style}`);
      });
    });

    it('should handle empty vset string', () => {
      const line = buildOptionsLine({
        id: 'test123',
        vset: '',
      });

      // Empty string is falsy, should not include vset
      expect(line).toBe('# vcalc: id=test123');
    });

    it('should preserve option order (id always first)', () => {
      const line = buildOptionsLine({
        id: 'test123',
        vset: 'main',
        hidden: true,
      });

      const parts = line.split(' ');
      expect(parts[2]).toBe('id=test123'); // After "# vcalc:"
    });
  });

  describe('Roundtrip: buildOptionsLine -> parseVsetFromCodeBlock', () => {
    it('should roundtrip minimal options', () => {
      const original = {
        id: 'abc123',
      };
      const line = buildOptionsLine(original);
      const code = `${line}\nx = 5`;

      const callout = createMockCallout(code);
      const parsed = parseVsetFromCodeBlock(callout);

      expect(parsed.id).toBe(original.id);
      expect(parsed.code).toBe('x = 5');
    });

    it('should roundtrip all options', () => {
      const original = {
        id: 'test123',
        vset: 'physics',
        hidden: true,
        accentVset: true,
        bgStyle: 'transparent',
        compact: true,
      };
      const line = buildOptionsLine(original);
      const code = `${line}\nx = 5`;

      const callout = createMockCallout(code);
      const parsed = parseVsetFromCodeBlock(callout);

      expect(parsed.id).toBe(original.id);
      expect(parsed.vset).toBe(original.vset);
      expect(parsed.hidden).toBe(original.hidden);
      expect(parsed.accentVset).toBe(original.accentVset);
      expect(parsed.bgStyle).toBe(original.bgStyle);
      expect(parsed.compact).toBe(original.compact);
      expect(parsed.code).toBe('x = 5');
    });

    it('should roundtrip with accent=default', () => {
      const original = {
        id: 'test123',
        accentVset: false,
      };
      const line = buildOptionsLine(original);
      const code = `${line}\nx = 5`;

      const callout = createMockCallout(code);
      const parsed = parseVsetFromCodeBlock(callout);

      expect(parsed.accentVset).toBe(false);
    });
  });
});
