/**
 * @fileoverview Pyodide (Python in WebAssembly) execution manager for VCalc.
 *
 * This module provides a singleton manager for the Pyodide runtime, which allows
 * executing Python code directly in the browser without requiring a Python
 * installation. The Python environment is used to parse mathematical expressions,
 * perform calculations, and generate LaTeX output.
 *
 * ## Architecture
 *
 * ```
 * VCalc Block → PyodideExecutor → Pyodide (WASM) → Python Code → LaTeX Output
 *                     ↓                                ↓
 *              ensureLoaded()                  converter.py template
 *                     ↓                                ↓
 *              CDN script load               AST parsing + SymPy
 * ```
 *
 * ## Lazy Loading
 *
 * Pyodide is loaded on-demand when the first calculation is executed, not at
 * plugin startup. This improves Obsidian startup time since the ~10MB Pyodide
 * bundle is only downloaded when actually needed.
 *
 * ## Electron Compatibility
 *
 * Obsidian runs in Electron, which exposes a `process` global that makes
 * Pyodide think it's running in Node.js. We set `process.browser = true`
 * to force browser API usage. See: https://github.com/pyodide/pyodide/discussions/2248
 *
 * @module python/pyodide-executor
 * @see {@link converter} for the Python code generation
 * @see {@link types#PythonResult} for the execution result structure
 */

import { VariableSet, PythonResult, DisplayOptions } from '../types';
import { generateConverterCode, generateConverterCodeWithVars } from './converter';
import { CONSOLE } from '../messages';

/**
 * Singleton manager for Pyodide (Python WebAssembly) execution.
 *
 * Provides lazy-loaded Python execution capabilities with variable injection
 * and LaTeX output generation. Uses the singleton pattern to ensure only one
 * Pyodide instance exists (each instance is ~10MB in memory).
 *
 * ## Usage
 *
 * ```typescript
 * const executor = PyodideExecutor.getInstance();
 *
 * // Optional: Show loading UI during first load
 * executor.setLoadCallbacks(
 *     () => new Notice('Loading Python environment...'),
 *     () => new Notice('Python ready!')
 * );
 *
 * // Execute Python code with variable injection
 * const result = await executor.pythonToLatexWithVars(
 *     'z = x + y',
 *     { x: { value: 5, type: 'int', ... }, y: { value: 10, type: 'int', ... } },
 *     { showSymbolic: true, showSubstitution: true, showResult: true }
 * );
 * // result.latex = '\\begin{aligned} z &= x + y = 5 + 10 = 15 \\end{aligned}'
 * // result.variables = { z: { value: 15, type: 'int' } }
 * ```
 *
 * @see {@link generateConverterCodeWithVars} for the Python code template
 */
export class PyodideExecutor {
    private static instance: PyodideExecutor | null = null;
    private pyodide: any = null;
    private isLoading = false;
    private loadPromise: Promise<void> | null = null;
    private onLoadStart: (() => void) | null = null;
    private onLoadComplete: (() => void) | null = null;

    /**
     * Private constructor to enforce singleton pattern.
     * Use {@link getInstance} to obtain the executor instance.
     */
    private constructor() {}

    /**
     * Sets callbacks for Pyodide load events.
     *
     * Useful for showing loading UI during the first calculation, since
     * Pyodide takes several seconds to download and initialize (~10MB).
     *
     * @param onStart - Called when Pyodide loading begins
     * @param onComplete - Called when Pyodide is ready (or loading fails)
     *
     * @example
     * ```typescript
     * executor.setLoadCallbacks(
     *     () => new Notice('Loading Python environment (first time only)...'),
     *     () => new Notice('Python environment ready!')
     * );
     * ```
     */
    setLoadCallbacks(onStart: () => void, onComplete: () => void): void {
        this.onLoadStart = onStart;
        this.onLoadComplete = onComplete;
    }

    /**
     * Gets the singleton PyodideExecutor instance.
     *
     * Creates the instance on first call (lazy initialization). All VCalc
     * components should use this method to get the executor rather than
     * trying to construct one directly.
     *
     * @returns The shared PyodideExecutor instance
     */
    static getInstance(): PyodideExecutor {
        if (!PyodideExecutor.instance) {
            PyodideExecutor.instance = new PyodideExecutor();
        }
        return PyodideExecutor.instance;
    }

    /**
     * Ensures Pyodide is loaded before executing Python code.
     *
     * If Pyodide is already loaded, returns immediately. If loading is in
     * progress, waits for it to complete. Otherwise, starts the loading process.
     *
     * Calls the registered `onLoadStart` callback before loading and
     * `onLoadComplete` after loading finishes (success or failure).
     *
     * @internal Called automatically by execution methods
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
     * Loads the Pyodide runtime from CDN.
     *
     * Handles Electron compatibility by setting `process.browser = true` to
     * force Pyodide to use browser APIs instead of Node.js APIs.
     *
     * ## Loading Process
     *
     * 1. Set `process.browser` flag for Electron compatibility
     * 2. Inject Pyodide script tag from jsDelivr CDN
     * 3. Wait for script to load
     * 4. Call `loadPyodide()` global function
     * 5. Store instance for reuse
     *
     * @throws Error if script fails to load or Pyodide initialization fails
     * @internal Called by {@link ensureLoaded}
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

            console.log(CONSOLE.PYODIDE_LOADED);
        } catch (error) {
            console.error(CONSOLE.PYODIDE_FAILED, error);
            throw new Error(`Failed to load Pyodide: ${error}`);
        }
    }

    /**
     * Builds Python code to inject existing variables into the execution namespace.
     *
     * Converts JavaScript values to Python literals that can be exec'd.
     * Handles strings, numbers, booleans, null (→ None), and JSON-serializable objects.
     *
     * @param existingVars - Variables to inject from the current vset
     * @returns Python code string with variable assignments
     *
     * @example
     * ```typescript
     * const vars = {
     *     x: { value: 5, type: 'int', ... },
     *     name: { value: 'test', type: 'str', ... },
     *     flag: { value: true, type: 'bool', ... }
     * };
     * const injection = this.buildVarInjection(vars);
     * // injection = 'x = 5\nname = "test"\nflag = True\n'
     * ```
     *
     * @internal Implementation detail of {@link pythonToLatexWithVars}
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
     * Executes Python code and returns LaTeX output with variable information.
     *
     * This is the primary execution method used by VCalc blocks. It:
     * 1. Ensures Pyodide is loaded (lazy loading on first call)
     * 2. Injects existing variables from the vset into the namespace
     * 3. Executes the user's Python code through the converter template
     * 4. Returns structured result with LaTeX and new variable values
     *
     * @param code - Python code to execute (user's calculation)
     * @param existingVars - Variables from the current vset to inject
     * @param displayOptions - Controls which equation parts appear in output
     * @returns Promise resolving to LaTeX string and variable information
     * @throws Error if Python execution fails (syntax error, runtime error, etc.)
     *
     * @example
     * ```typescript
     * const result = await executor.pythonToLatexWithVars(
     *     'z = x + y',
     *     { x: { value: 5, ... }, y: { value: 10, ... } },
     *     { showSymbolic: true, showSubstitution: true, showResult: true }
     * );
     * // result.latex = '\\begin{aligned}z &= x + y = 5 + 10 = 15\\end{aligned}'
     * // result.variables = { z: { value: 15, type: 'int' } }
     * ```
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
     * Executes Python code and returns a simple LaTeX string.
     *
     * Simpler variant of {@link pythonToLatexWithVars} that doesn't inject
     * existing variables or return variable information. Useful for standalone
     * calculations that don't need vset integration.
     *
     * @param code - Python code to execute
     * @returns Promise resolving to LaTeX output string
     * @throws Error if Python execution fails
     *
     * @deprecated Prefer {@link pythonToLatexWithVars} for full functionality
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
     * Checks if Pyodide is loaded and ready for execution.
     *
     * Useful for UI elements that want to show different states based on
     * whether Python is available (e.g., "Run" vs "Loading...").
     *
     * @returns `true` if Pyodide is loaded and ready, `false` otherwise
     */
    isReady(): boolean {
        return this.pyodide !== null;
    }

    /**
     * Resets the Pyodide instance.
     *
     * Clears the loaded Pyodide instance, allowing it to be reloaded on next
     * use. Primarily used for testing to ensure clean state between tests.
     *
     * **Warning**: This does not free memory immediately; the old Pyodide
     * instance will be garbage collected when no longer referenced.
     */
    reset(): void {
        this.pyodide = null;
        this.isLoading = false;
        this.loadPromise = null;
    }
}
