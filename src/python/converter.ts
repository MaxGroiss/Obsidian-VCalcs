import { DisplayOptions } from '../types';

/**
 * Generates Python code that converts user code to LaTeX.
 * This is the simple version without variable injection.
 */
export function generateConverterCode(userCode: string): string {
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
        # Convert variable names: x_1 -> x_{1}, Gamma_L -> \\\\Gamma_{L}
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

/**
 * Generates Python code that converts user code to LaTeX with variable injection.
 * This version supports injecting existing variables and extracting new ones.
 */
export function generateConverterCodeWithVars(
    userCode: string, 
    varInjection: string, 
    displayOptions: DisplayOptions
): string {
    // Escape the user code and var injection for embedding in Python string
    const escapedCode = userCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const escapedVars = varInjection.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    
    // Convert display options to Python booleans
    const showSymbolic = displayOptions.showSymbolic ? 'True' : 'False';
    const showSubstitution = displayOptions.showSubstitution ? 'True' : 'False';
    const showResult = displayOptions.showResult ? 'True' : 'False';
    
    return `
import ast
import math
import sys
import json

# Display options
SHOW_SYMBOLIC = ${showSymbolic}
SHOW_SUBSTITUTION = ${showSubstitution}
SHOW_RESULT = ${showResult}

# Make math functions available
from math import sqrt, sin, cos, tan, log, log10, exp, pi, e, atan, asin, acos

def expr_to_latex(node, namespace=None):
    """Convert an AST expression node to LaTeX string."""
    if namespace is None:
        namespace = {}
    
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        name = node.id
        greek = {'alpha': '\\\\alpha', 'beta': '\\\\beta', 'gamma': '\\\\gamma', 
                 'Gamma': '\\\\Gamma', 'delta': '\\\\delta', 'Delta': '\\\\Delta',
                 'epsilon': '\\\\epsilon', 'zeta': '\\\\zeta', 'eta': '\\\\eta',
                 'theta': '\\\\theta', 'Theta': '\\\\Theta', 'lambda': '\\\\lambda',
                 'Lambda': '\\\\Lambda', 'mu': '\\\\mu', 'nu': '\\\\nu', 'xi': '\\\\xi',
                 'pi': '\\\\pi', 'Pi': '\\\\Pi', 'rho': '\\\\rho', 'sigma': '\\\\sigma',
                 'Sigma': '\\\\Sigma', 'tau': '\\\\tau', 'phi': '\\\\phi', 'Phi': '\\\\Phi',
                 'chi': '\\\\chi', 'psi': '\\\\psi', 'Psi': '\\\\Psi', 'omega': '\\\\omega',
                 'Omega': '\\\\Omega'}
        
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
            return f"\\\\text{{{func_name}}}\\\\left({', '.join(args)}\\\\right)"
    
    return expr_to_latex(node, namespace)

def python_to_latex_with_vars(code, existing_vars_code):
    """Main conversion function that returns latex and variables."""
    # First inject existing variables
    namespace = {'sqrt': sqrt, 'abs': abs, 'sin': sin, 'cos': cos, 'tan': tan,
                 'log': log, 'log10': log10, 'exp': exp, 'pi': pi, 'e': e,
                 'atan': atan, 'asin': asin, 'acos': acos, 'j': 1j}
    
    if existing_vars_code:
        exec(existing_vars_code, namespace)
    
    tree = ast.parse(code)
    
    latex_lines = []
    new_variables = {}
    
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                continue
            
            var_name = target.id
            expr = node.value
            
            # Execute to get value
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<string>', 'exec'), namespace)
            value = namespace[var_name]
            
            # Store variable info
            var_type = type(value).__name__
            new_variables[var_name] = {'value': value if not isinstance(value, complex) else str(value), 'type': var_type}
            
            # Format result value
            if isinstance(value, float):
                value_str = f"{value:.4g}"
            elif isinstance(value, complex):
                value_str = f"({value.real:.4g} + {value.imag:.4g}j)"
            else:
                value_str = str(value)
            
            # Convert variable name to LaTeX
            var_latex = expr_to_latex(target, namespace)
            
            # Build the equation based on display options
            # Check if simple constant assignment
            if isinstance(expr, ast.Constant):
                # For constants, just show var = value
                latex_lines.append(f"{var_latex} &= {value_str}")
            else:
                symbolic = expr_to_latex(expr, namespace)
                substituted = substitute_values(expr, namespace)
                
                # Build equation parts based on settings
                parts = [var_latex, "&="]
                
                if SHOW_SYMBOLIC:
                    parts.append(symbolic)
                
                if SHOW_SUBSTITUTION and substituted != symbolic:
                    if SHOW_SYMBOLIC:
                        parts.append("=")
                    parts.append(substituted)
                
                if SHOW_RESULT:
                    if SHOW_SYMBOLIC or SHOW_SUBSTITUTION:
                        parts.append("=")
                    parts.append(value_str)
                
                # If nothing is shown, at least show the result
                if not SHOW_SYMBOLIC and not SHOW_SUBSTITUTION and not SHOW_RESULT:
                    parts.append(value_str)
                
                latex_lines.append(" ".join(parts))
    
    # Build aligned environment
    latex = ""
    if latex_lines:
        latex = "\\\\begin{aligned}\\n"
        for i, line in enumerate(latex_lines):
            if i > 0:
                latex += "\\\\\\\\\\n" if "= " in latex_lines[i-1] and latex_lines[i-1].count("=") == 1 else "\\\\\\\\[8pt]\\n"
            latex += line
        latex += "\\n\\\\end{aligned}"
    
    return latex, new_variables

# Execute
code = '''${escapedCode}'''
existing_vars = '''${escapedVars}'''
try:
    latex, variables = python_to_latex_with_vars(code, existing_vars)
    result = json.dumps({'latex': latex, 'variables': variables})
    print(result)
except Exception as ex:
    print(f"Error: {ex}", file=sys.stderr)
    sys.exit(1)
`;
}
