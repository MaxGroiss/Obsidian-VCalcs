import { describe, it, expect } from 'vitest';
import { generateConverterCode, generateConverterCodeWithVars } from './converter';

describe('Converter', () => {
  describe('generateConverterCode', () => {
    it('should generate valid Python code', () => {
      const code = generateConverterCode('x = 5');

      expect(code).toContain('import ast');
      expect(code).toContain('import math');
      expect(code).toContain('import sys');
      expect(code).toContain('def expr_to_latex');
      expect(code).toContain('def python_to_latex');
    });

    it('should embed user code in Python string', () => {
      const userCode = 'x = 5\ny = 10';
      const code = generateConverterCode(userCode);

      // Check that code is embedded (with escaped newlines)
      expect(code).toContain("x = 5\\ny = 10");
    });

    it('should escape backslashes in user code', () => {
      const userCode = 'path = "C:\\Users\\test"';
      const code = generateConverterCode(userCode);

      // Backslashes should be doubled
      expect(code).toContain('C:\\\\Users\\\\test');
    });

    it('should escape single quotes in user code', () => {
      const userCode = "message = 'Hello'";
      const code = generateConverterCode(userCode);

      // Single quotes should be escaped
      expect(code).toContain("\\'Hello\\'");
    });

    it('should escape newlines in user code', () => {
      const userCode = 'x = 5\ny = 10\nz = 15';
      const code = generateConverterCode(userCode);

      // Newlines should be escaped
      expect(code).toContain('\\n');
      expect(code).not.toContain('x = 5\ny = 10'); // Should not have literal newlines
    });

    it('should handle empty user code', () => {
      const code = generateConverterCode('');

      expect(code).toContain("code = ''''''");
      expect(code).toContain('import ast');
    });

    it('should include math functions', () => {
      const code = generateConverterCode('x = 5');

      expect(code).toContain('from math import sqrt');
      expect(code).toContain('sin, cos, tan');
      expect(code).toContain('log, log10, exp');
      expect(code).toContain('pi, e');
    });

    it('should include Greek letter mappings', () => {
      const code = generateConverterCode('alpha = 5');

      expect(code).toContain("'alpha': '\\\\alpha'");
      expect(code).toContain("'beta': '\\\\beta'");
      expect(code).toContain("'gamma': '\\\\gamma'");
      expect(code).toContain("'Gamma': '\\\\Gamma'");
    });

    it('should handle multiline code with special characters', () => {
      const userCode = "# Comment\nx = 5\ny = 'test\\n'";
      const code = generateConverterCode(userCode);

      expect(code).toContain('\\\\n');
      expect(code).toContain("\\'test");
    });

    it('should include LaTeX formatting for operators', () => {
      const code = generateConverterCode('x = 5');

      expect(code).toContain('\\\\cdot'); // Multiplication
      expect(code).toContain('\\\\frac'); // Division
      expect(code).toContain('\\\\sqrt'); // Square root
      expect(code).toContain('\\\\left|'); // Absolute value
    });

    it('should handle Unicode characters', () => {
      const userCode = 'θ = 45';
      const code = generateConverterCode(userCode);

      // Should contain the Unicode character embedded
      expect(code).toContain('θ');
    });

    it('should escape triple quotes if present', () => {
      const userCode = 'doc = """test"""';
      const code = generateConverterCode(userCode);

      // Single quotes should be escaped, preventing triple quote issues
      expect(code).not.toContain("'''test'''");
    });
  });

  describe('generateConverterCodeWithVars', () => {
    it('should generate valid Python code with variable injection', () => {
      const code = generateConverterCodeWithVars(
        'y = x + 5',
        'x = 10',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('import ast');
      expect(code).toContain('import json');
      expect(code).toContain('def python_to_latex_with_vars');
      expect(code).toContain('existing_vars =');
    });

    it('should embed user code and variable injection', () => {
      const code = generateConverterCodeWithVars(
        'y = x + 5',
        'x = 10',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('y = x + 5');
      expect(code).toContain('x = 10');
    });

    it('should set display options to True when enabled', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('SHOW_SYMBOLIC = True');
      expect(code).toContain('SHOW_SUBSTITUTION = True');
      expect(code).toContain('SHOW_RESULT = True');
    });

    it('should set display options to False when disabled', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: false, showSubstitution: false, showResult: false }
      );

      expect(code).toContain('SHOW_SYMBOLIC = False');
      expect(code).toContain('SHOW_SUBSTITUTION = False');
      expect(code).toContain('SHOW_RESULT = False');
    });

    it('should handle mixed display options', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: true, showSubstitution: false, showResult: true }
      );

      expect(code).toContain('SHOW_SYMBOLIC = True');
      expect(code).toContain('SHOW_SUBSTITUTION = False');
      expect(code).toContain('SHOW_RESULT = True');
    });

    it('should escape backslashes in user code', () => {
      const code = generateConverterCodeWithVars(
        'path = "C:\\test"',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('C:\\\\test');
    });

    it('should escape backslashes in variable injection', () => {
      const code = generateConverterCodeWithVars(
        'y = x',
        'x = "C:\\path"',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('C:\\\\path');
    });

    it('should escape single quotes in user code', () => {
      const code = generateConverterCodeWithVars(
        "msg = 'hello'",
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain("\\'hello\\'");
    });

    it('should escape single quotes in variable injection', () => {
      const code = generateConverterCodeWithVars(
        'y = x',
        "x = 'test'",
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain("\\'test\\'");
    });

    it('should escape newlines in user code', () => {
      const code = generateConverterCodeWithVars(
        'x = 5\ny = 10',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('x = 5\\ny = 10');
    });

    it('should escape newlines in variable injection', () => {
      const code = generateConverterCodeWithVars(
        'y = x',
        'x = 5\nz = 10',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('x = 5\\nz = 10');
    });

    it('should handle empty variable injection', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain("existing_vars = ''''''");
    });

    it('should include JSON output formatting', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('import json');
      expect(code).toContain("json.dumps({'latex': latex, 'variables': variables})");
    });

    it('should include complex number support', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain("'j': 1j");
      expect(code).toContain('isinstance(value, complex)');
    });

    it('should handle all display options combinations', () => {
      const combinations = [
        { showSymbolic: true, showSubstitution: true, showResult: true },
        { showSymbolic: true, showSubstitution: true, showResult: false },
        { showSymbolic: true, showSubstitution: false, showResult: true },
        { showSymbolic: true, showSubstitution: false, showResult: false },
        { showSymbolic: false, showSubstitution: true, showResult: true },
        { showSymbolic: false, showSubstitution: true, showResult: false },
        { showSymbolic: false, showSubstitution: false, showResult: true },
        { showSymbolic: false, showSubstitution: false, showResult: false },
      ];

      combinations.forEach((opts) => {
        const code = generateConverterCodeWithVars('x = 5', '', opts);

        expect(code).toContain(`SHOW_SYMBOLIC = ${opts.showSymbolic ? 'True' : 'False'}`);
        expect(code).toContain(`SHOW_SUBSTITUTION = ${opts.showSubstitution ? 'True' : 'False'}`);
        expect(code).toContain(`SHOW_RESULT = ${opts.showResult ? 'True' : 'False'}`);
      });
    });

    it('should handle multiline variable injection', () => {
      const code = generateConverterCodeWithVars(
        'z = x + y',
        'x = 5\ny = 10',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('x = 5\\ny = 10');
    });

    it('should include variable extraction logic', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      expect(code).toContain('new_variables = {}');
      expect(code).toContain("new_variables[var_name] = {'value': value");
      expect(code).toContain("'type': var_type");
    });

    it('should escape special regex characters in code', () => {
      const code = generateConverterCodeWithVars(
        'x = (5 + 10) * 2',
        '',
        { showSymbolic: true, showSubstitution: true, showResult: true }
      );

      // Parentheses and other chars should be preserved
      expect(code).toContain('(5 + 10) * 2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle code with both types of quotes', () => {
      const userCode = `message = 'It's "great"'`;
      const code = generateConverterCode(userCode);

      expect(code).toContain("\\'It\\'s");
      expect(code).toContain('"great"');
    });

    it('should handle code with consecutive backslashes', () => {
      const userCode = 'path = "C:\\\\Users\\\\test"';
      const code = generateConverterCode(userCode);

      // Each backslash becomes double backslash
      expect(code).toContain('C:\\\\\\\\Users\\\\\\\\test');
    });

    it('should handle very long user code', () => {
      const longCode = 'x = 5\n'.repeat(1000);
      const code = generateConverterCode(longCode);

      expect(code).toContain('import ast');
      expect(code.length).toBeGreaterThan(1000);
    });

    it('should handle code with no assignments', () => {
      const userCode = 'print("hello")';
      const code = generateConverterCode(userCode);

      expect(code).toContain('print("hello")');
      expect(code).toContain('import ast');
    });

    it('should handle code with only comments', () => {
      const userCode = '# This is a comment\n# Another comment';
      const code = generateConverterCode(userCode);

      expect(code).toContain('# This is a comment');
    });

    it('should handle empty variable injection with all display options', () => {
      const code = generateConverterCodeWithVars(
        'x = 5',
        '',
        { showSymbolic: false, showSubstitution: false, showResult: false }
      );

      expect(code).toContain("existing_vars = ''''''");
      expect(code).toContain('SHOW_SYMBOLIC = False');
    });

    it('should handle code with only whitespace', () => {
      const code = generateConverterCode('   \n\t  \n   ');

      expect(code).toContain('import ast');
    });

    it('should preserve indentation in user code', () => {
      const userCode = 'x = 5\n  y = 10'; // Unusual indentation
      const code = generateConverterCode(userCode);

      // Should preserve the spacing (as \\n escapes)
      expect(code).toContain('x = 5\\n  y = 10');
    });
  });
});
