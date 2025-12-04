import { vi } from 'vitest';

/**
 * Mock Pyodide instance and loader
 */

export class MockPyodideInstance {
  private stdout: { batched: (output: string) => void } | null = null;
  private pythonResults = new Map<string, any>();

  setStdout(config: { batched: (output: string) => void }) {
    this.stdout = config;
  }

  async runPythonAsync(code: string): Promise<any> {
    // Check if we have a mock result for this code
    const mockResult = this.pythonResults.get(code);
    if (mockResult !== undefined) {
      if (mockResult.stdout && this.stdout) {
        this.stdout.batched(mockResult.stdout);
      }
      if (mockResult.error) {
        throw mockResult.error;
      }
      return mockResult.return;
    }

    // Default behavior: extract simple JSON from code
    // This handles basic test cases where code contains JSON
    const jsonMatch = code.match(/\{[\s\S]*"latex"[\s\S]*\}/);
    if (jsonMatch && this.stdout) {
      this.stdout.batched(jsonMatch[0]);
      return;
    }

    // Default empty result
    if (this.stdout) {
      this.stdout.batched(JSON.stringify({ latex: '', variables: {} }));
    }
  }

  // Helper for tests to set up expected results
  mockPythonResult(code: string, result: { stdout?: string; return?: any; error?: Error }) {
    this.pythonResults.set(code, result);
  }

  // Helper to clear mocks
  clearMocks() {
    this.pythonResults.clear();
    this.stdout = null;
  }
}

export const mockPyodideInstance = new MockPyodideInstance();

export const mockLoadPyodide = vi.fn(async () => {
  return mockPyodideInstance;
});

// Mock global loadPyodide function
(global as any).loadPyodide = mockLoadPyodide;
