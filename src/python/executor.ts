import { spawn } from 'child_process';
import { VariableSet, PythonResult, DisplayOptions } from '../types';
import { generateConverterCode, generateConverterCodeWithVars } from './converter';

/**
 * Build variable injection code from existing variables.
 */
export function buildVarInjection(existingVars: VariableSet): string {
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
 * Execute Python code and return LaTeX with variable information.
 */
export async function pythonToLatexWithVars(
    pythonPath: string,
    code: string, 
    existingVars: VariableSet,
    displayOptions: DisplayOptions
): Promise<PythonResult> {
    return new Promise((resolve, reject) => {
        // Build variable injection code
        const varInjection = buildVarInjection(existingVars);
        
        // Generate the Python code
        const pythonCode = generateConverterCodeWithVars(code, varInjection, displayOptions);
        
        const proc = spawn(pythonPath, ['-c', pythonCode]);
        
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on('close', (exitCode: number) => {
            if (exitCode === 0) {
                try {
                    // Parse JSON output: { latex: "...", variables: {...} }
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch (e) {
                    // Fallback: treat as plain latex string (old format)
                    resolve({ latex: stdout.trim(), variables: {} });
                }
            } else {
                reject(new Error(stderr || `Python exited with code ${exitCode}`));
            }
        });

        proc.on('error', (err: Error) => {
            reject(new Error(`Failed to start Python: ${err.message}`));
        });
    });
}

/**
 * Execute Python code and return simple LaTeX string.
 */
export async function pythonToLatex(
    pythonPath: string,
    code: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Generate the Python code
        const pythonCode = generateConverterCode(code);
        
        const proc = spawn(pythonPath, ['-c', pythonCode]);
        
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on('close', (exitCode: number) => {
            if (exitCode === 0) {
                resolve(stdout.trim());
            } else {
                reject(new Error(stderr || `Python exited with code ${exitCode}`));
            }
        });

        proc.on('error', (err: Error) => {
            reject(new Error(`Failed to start Python: ${err.message}`));
        });
    });
}
