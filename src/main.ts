import { Plugin, MarkdownPostProcessorContext, Notice, MarkdownView, MarkdownRenderer, Component } from 'obsidian';
import { spawn } from 'child_process';
import * as path from 'path';

interface CalcBlocksSettings {
    pythonPath: string;
    showSymbolic: boolean;
    showSubstitution: boolean;
    showResult: boolean;
}

const DEFAULT_SETTINGS: CalcBlocksSettings = {
    pythonPath: 'python3',
    showSymbolic: true,
    showSubstitution: true,
    showResult: true
};

export default class CalcBlocksPlugin extends Plugin {
    settings: CalcBlocksSettings;
    
    // Path to our Python converter script (bundled with plugin)
    private converterScript: string;

    async onload() {
        await this.loadSettings();
        
        // Write the Python converter script to plugin folder
        await this.setupConverterScript();

        // Register the callout post-processor for [!calculation] blocks
        this.registerMarkdownPostProcessor((element, context) => {
            this.processCalculationCallouts(element, context);
        });

        // Add command to insert a new calculation block
        this.addCommand({
            id: 'insert-calc-block',
            name: 'Insert Calculation Block',
            editorCallback: (editor) => {
                const template = `> [!calculation]\n> \`\`\`python\n> x = 5\n> y = 10\n> z = x + y\n> \`\`\`\n`;
                editor.replaceSelection(template);
            }
        });

        // Add command to run calculation under cursor
        this.addCommand({
            id: 'run-calc-block',
            name: 'Run Calculation Block',
            editorCallback: async (editor, ctx) => {
                const view = ctx instanceof MarkdownView ? ctx : this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    await this.runCalculationAtCursor(editor, view);
                }
            }
        });

        console.log('CalcBlocks plugin loaded');
    }

    async setupConverterScript() {
        // The Python script will be in the plugin's directory
        const pluginDir = (this.app.vault.adapter as any).basePath + '/.obsidian/plugins/obsidian-calcblocks';
        this.converterScript = path.join(pluginDir, 'python_to_latex.py');
        
        // We'll create this script if it doesn't exist
        // In production, it would be bundled with the plugin
    }

    processCalculationCallouts(element: HTMLElement, context: MarkdownPostProcessorContext) {
        // Find all callouts with [!calculation] type
        const callouts = element.querySelectorAll('.callout[data-callout="calculation"]');
        
        callouts.forEach((callout) => {
            this.enhanceCalculationCallout(callout as HTMLElement, context);
        });
    }

    enhanceCalculationCallout(callout: HTMLElement, context: MarkdownPostProcessorContext) {
        // Find the code block inside the callout
        const codeBlock = callout.querySelector('pre > code');
        if (!codeBlock) return;

        // Add buttons to the callout title
        const titleEl = callout.querySelector('.callout-title');
        if (titleEl && !titleEl.querySelector('.calc-btn-group')) {
            // Create button group
            const btnGroup = document.createElement('div');
            btnGroup.className = 'calc-btn-group';
            
            // Toggle Code button
            const toggleCodeBtn = document.createElement('button');
            toggleCodeBtn.className = 'calc-toggle-btn';
            toggleCodeBtn.textContent = '< >';
            toggleCodeBtn.title = 'Toggle Code';
            toggleCodeBtn.addEventListener('click', () => {
                const preEl = callout.querySelector('pre');
                if (preEl) {
                    preEl.classList.toggle('calc-hidden');
                    toggleCodeBtn.classList.toggle('calc-btn-active');
                }
            });
            btnGroup.appendChild(toggleCodeBtn);
            
            // Run button
            const runBtn = document.createElement('button');
            runBtn.className = 'calc-run-btn';
            runBtn.textContent = 'Run';
            runBtn.addEventListener('click', async () => {
                // Get the code fresh at click time (in case user edited it)
                const freshCodeBlock = callout.querySelector('pre > code');
                const pythonCode = freshCodeBlock?.textContent || '';
                console.log('CalcBlocks: Running code:', pythonCode);
                await this.executeAndRender(pythonCode, callout, context);
            });
            btnGroup.appendChild(runBtn);
            
            titleEl.appendChild(btnGroup);
        }
    }

    async executeAndRender(code: string, callout: HTMLElement, context: MarkdownPostProcessorContext) {
        try {
            const latex = await this.pythonToLatex(code);
            
            // Find or create the output container
            let outputContainer = callout.querySelector('.calc-output') as HTMLElement;
            if (!outputContainer) {
                outputContainer = document.createElement('div');
                outputContainer.className = 'calc-output';
                callout.querySelector('.callout-content')?.appendChild(outputContainer);
            }

            // Clear previous output
            outputContainer.empty();
            
            // Create wrapper for the rendered math
            const mathWrapper = document.createElement('div');
            mathWrapper.className = 'calc-math-wrapper';
            outputContainer.appendChild(mathWrapper);
            
            // Create the markdown string with proper LaTeX delimiters
            const markdownContent = `$$\n${latex}\n$$`;
            
            // Use Obsidian's MarkdownRenderer to render the LaTeX
            const component = new Component();
            component.load();
            await MarkdownRenderer.render(
                this.app,
                markdownContent,
                mathWrapper,
                context.sourcePath,
                component
            );

            // Add collapsible LaTeX source section
            const detailsEl = document.createElement('details');
            detailsEl.className = 'calc-latex-source';
            
            const summaryEl = document.createElement('summary');
            summaryEl.textContent = 'LaTeX Source';
            detailsEl.appendChild(summaryEl);
            
            const sourceContainer = document.createElement('div');
            sourceContainer.className = 'calc-source-content';
            
            // The actual LaTeX code (copyable)
            const codeEl = document.createElement('pre');
            const codeInner = document.createElement('code');
            codeInner.textContent = `$$\n${latex}\n$$`;
            codeEl.appendChild(codeInner);
            sourceContainer.appendChild(codeEl);
            
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'calc-copy-btn';
            copyBtn.textContent = 'Copy LaTeX';
            copyBtn.addEventListener('click', async () => {
                await navigator.clipboard.writeText(`$$\n${latex}\n$$`);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy LaTeX'; }, 2000);
            });
            sourceContainer.appendChild(copyBtn);
            
            detailsEl.appendChild(sourceContainer);
            outputContainer.appendChild(detailsEl);

            new Notice('Calculation rendered!');
        } catch (error) {
            new Notice(`Error: ${(error as Error).message}`);
            console.error('CalcBlocks error:', error);
        }
    }

    async pythonToLatex(code: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Spawn Python process with our converter script
            const pythonCode = this.generateConverterCode(code);
            
            const proc = spawn(this.settings.pythonPath, ['-c', pythonCode]);
            
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (exitCode) => {
                if (exitCode === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(stderr || `Python exited with code ${exitCode}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to start Python: ${err.message}`));
            });
        });
    }

    generateConverterCode(userCode: string): string {
        // Escape the user code for embedding in Python string
        const escapedCode = userCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        
        return `
import ast
import math
import sys

# Make math functions available
from math import sqrt, sin, cos, tan, log, log10, exp, pi, e, atan, asin, acos

def expr_to_latex(node, namespace=None):
    """Convert an AST expression node to LaTeX string."""
    if namespace is None:
        namespace = {}
    
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        # Convert variable names: x_1 -> x_{1}, Gamma_L -> \\Gamma_{L}
        name = node.id
        # Handle Greek letters
        greek = {'alpha': '\\\\alpha', 'beta': '\\\\beta', 'gamma': '\\\\gamma', 
                 'Gamma': '\\\\Gamma', 'delta': '\\\\delta', 'Delta': '\\\\Delta',
                 'epsilon': '\\\\epsilon', 'zeta': '\\\\zeta', 'eta': '\\\\eta',
                 'theta': '\\\\theta', 'Theta': '\\\\Theta', 'lambda': '\\\\lambda',
                 'Lambda': '\\\\Lambda', 'mu': '\\\\mu', 'nu': '\\\\nu', 'xi': '\\\\xi',
                 'pi': '\\\\pi', 'Pi': '\\\\Pi', 'rho': '\\\\rho', 'sigma': '\\\\sigma',
                 'Sigma': '\\\\Sigma', 'tau': '\\\\tau', 'phi': '\\\\phi', 'Phi': '\\\\Phi',
                 'chi': '\\\\chi', 'psi': '\\\\psi', 'Psi': '\\\\Psi', 'omega': '\\\\omega',
                 'Omega': '\\\\Omega'}
        
        # Check for subscript pattern: var_subscript
        if '_' in name:
            parts = name.split('_', 1)
            base = greek.get(parts[0], parts[0])
            return f"{base}_{{{parts[1]}}}"
        return greek.get(name, name)
    
    elif isinstance(node, ast.BinOp):
        left = expr_to_latex(node.left, namespace)
        right = expr_to_latex(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\\\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
        elif isinstance(node.op, ast.Mod):
            return f"{left} \\\\mod {right}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = expr_to_latex(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        elif isinstance(node.op, ast.UAdd):
            return f"+{operand}"
    
    elif isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
        args = [expr_to_latex(arg, namespace) for arg in node.args]
        
        # Special function rendering
        if func_name == 'sqrt':
            return f"\\\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\\\left|{args[0]}\\\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'ln', 'exp'):
            return f"\\\\{func_name}\\\\left({args[0]}\\\\right)"
        elif func_name == 'log10':
            return f"\\\\log_{{10}}\\\\left({args[0]}\\\\right)"
        elif func_name == 'pow':
            return f"{args[0]}^{{{args[1]}}}"
        else:
            return f"\\\\text{{{func_name}}}({', '.join(args)})"
    
    elif isinstance(node, ast.Compare):
        left = expr_to_latex(node.left, namespace)
        result = left
        for op, comparator in zip(node.ops, node.comparators):
            right = expr_to_latex(comparator, namespace)
            if isinstance(op, ast.Eq):
                result += f" = {right}"
            elif isinstance(op, ast.Lt):
                result += f" < {right}"
            elif isinstance(op, ast.Gt):
                result += f" > {right}"
            elif isinstance(op, ast.LtE):
                result += f" \\\\leq {right}"
            elif isinstance(op, ast.GtE):
                result += f" \\\\geq {right}"
        return result
    
    return str(ast.dump(node))

def substitute_values(node, namespace):
    """Create LaTeX with values substituted."""
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        val = namespace.get(node.id, node.id)
        if isinstance(val, float):
            return f"{val:.4g}"
        return str(val)
    
    elif isinstance(node, ast.BinOp):
        left = substitute_values(node.left, namespace)
        right = substitute_values(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\\\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = substitute_values(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        return operand
    
    elif isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
        args = [substitute_values(arg, namespace) for arg in node.args]
        
        if func_name == 'sqrt':
            return f"\\\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\\\left|{args[0]}\\\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'exp'):
            return f"\\\\{func_name}\\\\left({args[0]}\\\\right)"
        else:
            return f"\\\\text{{{func_name}}}({', '.join(args)})"
    
    return str(node)

def python_to_latex(code):
    """Main conversion function."""
    tree = ast.parse(code)
    namespace = {'sqrt': sqrt, 'abs': abs, 'sin': sin, 'cos': cos, 'tan': tan,
                 'log': log, 'log10': log10, 'exp': exp, 'pi': pi, 'e': e,
                 'atan': atan, 'asin': asin, 'acos': acos}
    
    latex_lines = []
    
    for node in tree.body:
        # Only process assignments
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                continue
            
            var_name = target.id
            expr = node.value
            
            # Execute to get value
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<string>', 'exec'), namespace)
            value = namespace[var_name]
            
            # Format result value
            if isinstance(value, float):
                value_str = f"{value:.4g}"
            else:
                value_str = str(value)
            
            # Convert variable name to LaTeX
            var_latex = expr_to_latex(target, namespace)
            
            # Check if it's a simple constant assignment
            if isinstance(expr, ast.Constant):
                latex_lines.append(f"{var_latex} &= {value_str}")
            else:
                # Full equation: var = symbolic = substituted = result
                symbolic = expr_to_latex(expr, namespace)
                substituted = substitute_values(expr, namespace)
                
                # Only show substitution if different from symbolic
                if substituted != symbolic:
                    latex_lines.append(f"{var_latex} &= {symbolic} = {substituted} = {value_str}")
                else:
                    latex_lines.append(f"{var_latex} &= {symbolic} = {value_str}")
        
        # Silently ignore other statements (print, import, etc.)
    
    # Build aligned environment
    if latex_lines:
        # Add extra spacing before calculations (after simple assignments)
        result = "\\\\begin{aligned}\\n"
        for i, line in enumerate(latex_lines):
            if i > 0:
                # Check if previous was simple assignment and this is calculation
                result += "\\\\\\\\\\n" if "= " in latex_lines[i-1] and latex_lines[i-1].count("=") == 1 else "\\\\\\\\[8pt]\\n"
            result += line
        result += "\\n\\\\end{aligned}"
        return result
    
    return ""

# Execute
code = '''${escapedCode}'''
try:
    result = python_to_latex(code)
    print(result)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
    }

    async runCalculationAtCursor(editor: any, view: MarkdownView) {
        const cursor = editor.getCursor();
        const content = editor.getValue();
        const lines = content.split('\n');
        
        // Find the calculation callout containing the cursor
        let calloutStart = -1;
        let calloutEnd = -1;
        let inCallout = false;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^>\s*\[!calculation\]/i)) {
                calloutStart = i;
                inCallout = true;
            } else if (inCallout && !lines[i].startsWith('>')) {
                calloutEnd = i;
                inCallout = false;
                
                if (cursor.line >= calloutStart && cursor.line < calloutEnd) {
                    break;
                }
                calloutStart = -1;
            }
        }
        
        if (calloutStart === -1) {
            new Notice('Cursor is not inside a calculation block');
            return;
        }
        
        if (calloutEnd === -1) calloutEnd = lines.length;
        
        // Extract Python code from the callout
        const calloutLines = lines.slice(calloutStart, calloutEnd);
        const codeMatch = calloutLines.join('\n').match(/```python\n([\s\S]*?)```/);
        
        if (!codeMatch) {
            new Notice('No Python code found in calculation block');
            return;
        }
        
        // Remove the "> " prefix from each line of code
        const pythonCode = codeMatch[1].split('\n').map((line: string) => 
            line.startsWith('> ') ? line.slice(2) : line
        ).join('\n').trim();
        
        try {
            const latex = await this.pythonToLatex(pythonCode);
            
            // Find where to insert/update the LaTeX output
            const outputMarker = '> <!-- calc-output -->';
            let outputStart = -1;
            let outputEnd = -1;
            
            for (let i = calloutStart; i < calloutEnd; i++) {
                if (lines[i].includes('<!-- calc-output -->')) {
                    outputStart = i;
                }
                if (lines[i].includes('<!-- /calc-output -->')) {
                    outputEnd = i + 1;
                    break;
                }
            }
            
            // Build the new output block
            const outputBlock = [
                '> <!-- calc-output -->',
                '> $$',
                ...latex.split('\n').map((l: string) => `> ${l}`),
                '> $$',
                '> <!-- /calc-output -->'
            ].join('\n');
            
            if (outputStart !== -1 && outputEnd !== -1) {
                // Replace existing output
                lines.splice(outputStart, outputEnd - outputStart, outputBlock);
            } else {
                // Insert new output before callout end (after code block)
                const codeBlockEnd = calloutLines.findIndex((l: string) => l.match(/^>\s*```\s*$/)) + calloutStart + 1;
                lines.splice(codeBlockEnd, 0, outputBlock);
            }
            
            editor.setValue(lines.join('\n'));
            new Notice('Calculation updated!');
            
        } catch (error) {
            new Notice(`Error: ${error.message}`);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}