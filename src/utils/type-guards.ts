import { VariableValue, PythonResult } from '../types';

/**
 * Type guard to check if a value is a valid VariableValue
 * @param value - The value to check
 * @returns true if value is a valid VariableValue type
 */
export function isVariableValue(value: unknown): value is VariableValue {
    return (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        value === null ||
        Array.isArray(value) ||
        (typeof value === 'object' && value !== null)
    );
}

/**
 * Type guard to check if an object is a valid PythonResult
 * @param obj - The object to check
 * @returns true if obj matches PythonResult interface
 */
export function isPythonResult(obj: unknown): obj is PythonResult {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const result = obj as Record<string, unknown>;

    // Check required properties
    if (typeof result.latex !== 'string') {
        return false;
    }

    if (typeof result.variables !== 'object' || result.variables === null) {
        return false;
    }

    // Check optional errors property if present
    if (result.errors !== undefined && !Array.isArray(result.errors)) {
        return false;
    }

    // Validate variables structure
    const vars = result.variables as Record<string, unknown>;
    for (const key in vars) {
        const varInfo = vars[key];
        if (typeof varInfo !== 'object' || varInfo === null) {
            return false;
        }

        const info = varInfo as Record<string, unknown>;
        if (!isVariableValue(info.value) || typeof info.type !== 'string') {
            return false;
        }
    }

    return true;
}

/**
 * Type guard to check if an error is an Error object
 * @param error - The error to check
 * @returns true if error is an Error instance
 */
export function isError(error: unknown): error is Error {
    return error instanceof Error;
}

/**
 * Safely get error message from unknown error type
 * @param error - The error to extract message from
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
    if (isError(error)) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return String(error);
}

/**
 * Safely convert VariableValue to string for display
 * @param value - The variable value to convert
 * @returns String representation of the value
 */
export function variableValueToString(value: VariableValue): string {
    if (value === null) {
        return 'null';
    }
    if (Array.isArray(value)) {
        return JSON.stringify(value);
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return '[object]';
        }
    }
    return String(value);
}

/**
 * Extract a simplified, user-friendly error message from a Python traceback.
 * Returns the core error type and message without the full stack trace.
 *
 * @param error - The full error message (possibly containing Python traceback)
 * @returns A simplified error message suitable for display in a Notice
 *
 * @example
 * // Input: "Python execution failed: Traceback (most recent call last):\n  File...\nNameError: name 'x' is not defined"
 * // Output: "NameError: name 'x' is not defined"
 */
export function extractSimplifiedError(error: string): string {
    // Common Python error patterns to look for
    const errorPatterns = [
        /(\w+Error): (.+?)(?:\n|$)/,     // NameError, TypeError, ValueError, etc.
        /(\w+Exception): (.+?)(?:\n|$)/, // Custom exceptions
        /(\w+Warning): (.+?)(?:\n|$)/,   // Warnings
    ];

    for (const pattern of errorPatterns) {
        const match = error.match(pattern);
        if (match) {
            return `${match[1]}: ${match[2].trim()}`;
        }
    }

    // If no Python error pattern found, try to get the last meaningful line
    const lines = error.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
        // Get the last non-empty line that isn't a file reference
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line && !line.startsWith('File ') && !line.startsWith('  ')) {
                // Truncate if too long
                return line.length > 100 ? line.substring(0, 97) + '...' : line;
            }
        }
    }

    // Fallback: return a generic message
    return 'Calculation error';
}
