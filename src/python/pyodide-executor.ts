import { VariableSet, PythonResult, DisplayOptions } from '../types';
import { generateConverterCode, generateConverterCodeWithVars } from './converter';

/**
 * Singleton class to manage Pyodide instance and Python execution
 */
export class PyodideExecutor {
    private static instance: PyodideExecutor | null = null;
    private pyodide: any = null;
    private isLoading = false;
    private loadPromise: Promise<void> | null = null;

    private constructor() {}

    /**
     * Get the singleton instance
     */
    static getInstance(): PyodideExecutor {
        if (!PyodideExecutor.instance) {
            PyodideExecutor.instance = new PyodideExecutor();
        }
        return PyodideExecutor.instance;
    }

    /**
     * Ensure Pyodide is loaded before use
     */
    private async ensureLoaded(): Promise<void> {
        if (this.pyodide) {
            return; // Already loaded
        }

        if (this.loadPromise) {
            // Wait for existing load to complete
            await this.loadPromise;
            return;
        }

        // Start loading
        this.isLoading = true;
        this.loadPromise = this.loadPyodideInstance();

        try {
            await this.loadPromise;
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }

    /**
     * Load Pyodide from CDN
     */
    private async loadPyodideInstance(): Promise<void> {
        try {
            // Load Pyodide from CDN directly
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js';

            await new Promise<void>((resolve, reject) => {
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('Failed to load Pyodide script'));
                document.head.appendChild(script);
            });

            // loadPyodide is now available globally
            const loadPyodide = (window as any).loadPyodide;
            if (!loadPyodide) {
                throw new Error('loadPyodide not found on window object');
            }

            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/'
            });

            console.log('Pyodide loaded successfully');
        } catch (error) {
            console.error('Failed to load Pyodide:', error);
            throw new Error(`Failed to load Pyodide: ${error}`);
        }
    }

    /**
     * Build variable injection code from existing variables
     */
    private buildVarInjection(existingVars: VariableSet): string {
        let varInjection = '';
        for (const [varName, varInfo] of Object.entries(existingVars)) {
            const val = varInfo.value;
            if (typeof val === 'string') {
                varInjection += `${varName} = "${val}"\n`;
            } else if (typeof val === 'number' || typeof val === 'boolean') {
                varInjection += `${varName} = ${val}\n`;
            } else if (val === null) {
                varInjection += `${varName} = None\n`;
            } else {
                varInjection += `${varName} = ${JSON.stringify(val)}\n`;
            }
        }
        return varInjection;
    }

    /**
     * Execute Python code and return LaTeX with variable information
     */
    async pythonToLatexWithVars(
        code: string,
        existingVars: VariableSet,
        displayOptions: DisplayOptions
    ): Promise<PythonResult> {
        await this.ensureLoaded();

        // Build variable injection code
        const varInjection = this.buildVarInjection(existingVars);

        // Generate the Python code using existing converter
        const pythonCode = generateConverterCodeWithVars(code, varInjection, displayOptions);

        try {
            // Execute the Python code
            const stdout = await this.pyodide.runPythonAsync(pythonCode);

            // Parse JSON output: { latex: "...", variables: {...} }
            try {
                const result = JSON.parse(stdout);
                return result as PythonResult;
            } catch (e) {
                // Fallback: treat as plain latex string (old format)
                return { latex: stdout, variables: {} };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Python execution failed: ${errorMessage}`);
        }
    }

    /**
     * Execute Python code and return simple LaTeX string
     */
    async pythonToLatex(code: string): Promise<string> {
        await this.ensureLoaded();

        // Generate the Python code using existing converter
        const pythonCode = generateConverterCode(code);

        try {
            // Execute the Python code
            const result = await this.pyodide.runPythonAsync(pythonCode);
            return String(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Python execution failed: ${errorMessage}`);
        }
    }

    /**
     * Check if Pyodide is loaded
     */
    isReady(): boolean {
        return this.pyodide !== null;
    }

    /**
     * Reset the Pyodide instance (for cleanup/testing)
     */
    reset(): void {
        this.pyodide = null;
        this.isLoading = false;
        this.loadPromise = null;
    }
}
