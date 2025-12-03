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
    private onLoadStart: (() => void) | null = null;
    private onLoadComplete: (() => void) | null = null;

    private constructor() {}

    /**
     * Set callbacks for load events (useful for showing loading UI)
     */
    setLoadCallbacks(onStart: () => void, onComplete: () => void): void {
        this.onLoadStart = onStart;
        this.onLoadComplete = onComplete;
    }

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

        // Notify that loading is starting
        if (this.onLoadStart) {
            this.onLoadStart();
        }

        // Start loading
        this.isLoading = true;
        this.loadPromise = this.loadPyodideInstance();

        try {
            await this.loadPromise;
        } finally {
            this.isLoading = false;
            this.loadPromise = null;

            // Notify that loading is complete
            if (this.onLoadComplete) {
                this.onLoadComplete();
            }
        }
    }

    /**
     * Load Pyodide from CDN with Electron/Obsidian compatibility
     */
    private async loadPyodideInstance(): Promise<void> {
        try {
            // CRITICAL FIX for Electron/Obsidian:
            // Pyodide detects the 'process' global in Electron and incorrectly assumes Node.js
            // Setting process.browser signals to use browser APIs instead of Node.js modules
            // See: https://github.com/pyodide/pyodide/discussions/2248
            if (typeof process !== 'undefined' && !(process as any).browser) {
                (process as any).browser = 'Obsidian';
            }

            // Load Pyodide script from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';

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

            // Load Pyodide - will now use browser APIs thanks to process.browser flag
            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/'
            });

            console.log('Pyodide loaded successfully in Obsidian/Electron environment');
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
            // Capture stdout from Pyodide execution
            let capturedOutput = '';
            this.pyodide!.setStdout({ batched: (output: string) => { capturedOutput += output; } });

            // Execute the Python code (pyodide is guaranteed non-null after ensureLoaded)
            await this.pyodide!.runPythonAsync(pythonCode);

            // Parse JSON output from captured stdout: { latex: "...", variables: {...} }
            try {
                const result = JSON.parse(capturedOutput);
                return result as PythonResult;
            } catch (e) {
                // Fallback: treat as plain latex string (old format)
                return { latex: capturedOutput, variables: {} };
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
            // Capture stdout from Pyodide execution
            let capturedOutput = '';
            this.pyodide!.setStdout({ batched: (output: string) => { capturedOutput += output; } });

            // Execute the Python code (pyodide is guaranteed non-null after ensureLoaded)
            await this.pyodide!.runPythonAsync(pythonCode);

            return capturedOutput;
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
