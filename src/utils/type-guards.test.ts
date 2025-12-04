import { describe, it, expect } from 'vitest';
import {
  isVariableValue,
  isPythonResult,
  isError,
  getErrorMessage,
  variableValueToString,
} from './type-guards';

describe('Type Guards', () => {
  describe('isVariableValue', () => {
    it('should accept numbers', () => {
      expect(isVariableValue(0)).toBe(true);
      expect(isVariableValue(42)).toBe(true);
      expect(isVariableValue(-3.14)).toBe(true);
      expect(isVariableValue(Infinity)).toBe(true);
      expect(isVariableValue(NaN)).toBe(true);
    });

    it('should accept strings', () => {
      expect(isVariableValue('')).toBe(true);
      expect(isVariableValue('hello')).toBe(true);
      expect(isVariableValue('multi\nline')).toBe(true);
    });

    it('should accept booleans', () => {
      expect(isVariableValue(true)).toBe(true);
      expect(isVariableValue(false)).toBe(true);
    });

    it('should accept null', () => {
      expect(isVariableValue(null)).toBe(true);
    });

    it('should accept arrays', () => {
      expect(isVariableValue([])).toBe(true);
      expect(isVariableValue([1, 2, 3])).toBe(true);
      expect(isVariableValue(['a', 'b'])).toBe(true);
      expect(isVariableValue([1, 'mixed', true])).toBe(true);
    });

    it('should accept objects', () => {
      expect(isVariableValue({})).toBe(true);
      expect(isVariableValue({ key: 'value' })).toBe(true);
      expect(isVariableValue({ nested: { obj: 1 } })).toBe(true);
    });

    it('should reject undefined', () => {
      expect(isVariableValue(undefined)).toBe(false);
    });

    it('should reject functions', () => {
      expect(isVariableValue(() => {})).toBe(false);
      expect(isVariableValue(function() {})).toBe(false);
    });

    it('should reject symbols', () => {
      expect(isVariableValue(Symbol('test'))).toBe(false);
    });
  });

  describe('isPythonResult', () => {
    it('should accept valid PythonResult with no variables', () => {
      const result = {
        latex: 'x = 5',
        variables: {},
      };
      expect(isPythonResult(result)).toBe(true);
    });

    it('should accept valid PythonResult with variables', () => {
      const result = {
        latex: 'x = 5\\\\y = 10',
        variables: {
          x: { value: 5, type: 'int' },
          y: { value: 10, type: 'int' },
        },
      };
      expect(isPythonResult(result)).toBe(true);
    });

    it('should accept valid PythonResult with complex variable types', () => {
      const result = {
        latex: 'data',
        variables: {
          num: { value: 42, type: 'int' },
          str: { value: 'hello', type: 'str' },
          bool: { value: true, type: 'bool' },
          none: { value: null, type: 'NoneType' },
          arr: { value: [1, 2, 3], type: 'list' },
          obj: { value: { a: 1 }, type: 'dict' },
        },
      };
      expect(isPythonResult(result)).toBe(true);
    });

    it('should accept valid PythonResult with errors array', () => {
      const result = {
        latex: '',
        variables: {},
        errors: ['Error 1', 'Error 2'],
      };
      expect(isPythonResult(result)).toBe(true);
    });

    it('should accept valid PythonResult with empty errors array', () => {
      const result = {
        latex: 'x = 5',
        variables: { x: { value: 5, type: 'int' } },
        errors: [],
      };
      expect(isPythonResult(result)).toBe(true);
    });

    it('should reject null', () => {
      expect(isPythonResult(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isPythonResult(undefined)).toBe(false);
    });

    it('should reject non-objects', () => {
      expect(isPythonResult(42)).toBe(false);
      expect(isPythonResult('string')).toBe(false);
      expect(isPythonResult(true)).toBe(false);
    });

    it('should reject object missing latex property', () => {
      const result = {
        variables: {},
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject object with non-string latex', () => {
      const result = {
        latex: 123,
        variables: {},
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject object missing variables property', () => {
      const result = {
        latex: 'x = 5',
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject object with non-object variables', () => {
      const result = {
        latex: 'x = 5',
        variables: 'not an object',
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject object with null variables', () => {
      const result = {
        latex: 'x = 5',
        variables: null,
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject variable without value property', () => {
      const result = {
        latex: 'x = 5',
        variables: {
          x: { type: 'int' },
        },
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject variable without type property', () => {
      const result = {
        latex: 'x = 5',
        variables: {
          x: { value: 5 },
        },
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject variable with non-string type', () => {
      const result = {
        latex: 'x = 5',
        variables: {
          x: { value: 5, type: 123 },
        },
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject variable with invalid value (undefined)', () => {
      const result = {
        latex: 'x = undefined',
        variables: {
          x: { value: undefined, type: 'undefined' },
        },
      };
      expect(isPythonResult(result)).toBe(false);
    });

    it('should reject errors property that is not an array', () => {
      const result = {
        latex: 'x = 5',
        variables: {},
        errors: 'not an array',
      };
      expect(isPythonResult(result)).toBe(false);
    });
  });

  describe('isError', () => {
    it('should accept Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
      expect(isError(new ReferenceError('test'))).toBe(true);
    });

    it('should reject error-like objects', () => {
      expect(isError({ message: 'test', stack: 'stack' })).toBe(false);
    });

    it('should reject primitives', () => {
      expect(isError('error')).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
    });

    it('should reject plain objects', () => {
      expect(isError({})).toBe(false);
      expect(isError({ name: 'Error' })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error instances', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should extract message from TypeError', () => {
      const error = new TypeError('Type error');
      expect(getErrorMessage(error)).toBe('Type error');
    });

    it('should return string directly if error is string', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should convert number to string', () => {
      expect(getErrorMessage(404)).toBe('404');
    });

    it('should convert boolean to string', () => {
      expect(getErrorMessage(true)).toBe('true');
      expect(getErrorMessage(false)).toBe('false');
    });

    it('should convert null to string', () => {
      expect(getErrorMessage(null)).toBe('null');
    });

    it('should convert undefined to string', () => {
      expect(getErrorMessage(undefined)).toBe('undefined');
    });

    it('should convert object to string', () => {
      const obj = { message: 'test' };
      expect(getErrorMessage(obj)).toBe('[object Object]');
    });

    it('should convert array to string', () => {
      expect(getErrorMessage([1, 2, 3])).toBe('1,2,3');
    });
  });

  describe('variableValueToString', () => {
    it('should convert null to string', () => {
      expect(variableValueToString(null)).toBe('null');
    });

    it('should convert numbers to string', () => {
      expect(variableValueToString(42)).toBe('42');
      expect(variableValueToString(-3.14)).toBe('-3.14');
      expect(variableValueToString(0)).toBe('0');
    });

    it('should convert strings to string (identity)', () => {
      expect(variableValueToString('hello')).toBe('hello');
      expect(variableValueToString('')).toBe('');
    });

    it('should convert booleans to string', () => {
      expect(variableValueToString(true)).toBe('true');
      expect(variableValueToString(false)).toBe('false');
    });

    it('should convert arrays to JSON string', () => {
      expect(variableValueToString([1, 2, 3])).toBe('[1,2,3]');
      expect(variableValueToString(['a', 'b'])).toBe('["a","b"]');
      expect(variableValueToString([])).toBe('[]');
    });

    it('should convert objects to JSON string', () => {
      expect(variableValueToString({ key: 'value' })).toBe('{"key":"value"}');
      expect(variableValueToString({})).toBe('{}');
    });

    it('should handle nested objects', () => {
      const nested = { a: { b: { c: 1 } } };
      expect(variableValueToString(nested)).toBe('{"a":{"b":{"c":1}}}');
    });

    it('should handle circular references gracefully', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(variableValueToString(circular)).toBe('[object]');
    });

    it('should handle objects with special properties', () => {
      const obj = { value: 42, toString: () => 'custom' };
      const result = variableValueToString(obj);
      // Should use JSON.stringify which serializes properties (but not functions)
      // The toString function won't be serialized, only the value property
      expect(result).toContain('value');
      expect(result).toContain('42');
    });
  });
});
