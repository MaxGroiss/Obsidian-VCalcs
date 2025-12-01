#!/usr/bin/env python3
"""
CalcBlocks Python to LaTeX Converter

This script parses Python calculation code and converts it to LaTeX.
It's designed to be forgiving - it only processes assignments and
silently ignores print statements, imports, function definitions, etc.

Usage:
    python python_to_latex.py "x = 5; y = 10; z = x + y"
    
Or pipe code:
    echo "x = 5\ny = 10\nz = x + y" | python python_to_latex.py
"""

import ast
import math
import sys
from typing import Dict, Any, List, Tuple, Optional

# Make math functions available in the execution namespace
from math import sqrt, sin, cos, tan, log, log10, exp, pi, e, atan, asin, acos, sinh, cosh, tanh

# Greek letter mapping
GREEK_LETTERS = {
    'alpha': '\\alpha', 'beta': '\\beta', 'gamma': '\\gamma', 
    'Gamma': '\\Gamma', 'delta': '\\delta', 'Delta': '\\Delta',
    'epsilon': '\\epsilon', 'varepsilon': '\\varepsilon',
    'zeta': '\\zeta', 'eta': '\\eta',
    'theta': '\\theta', 'Theta': '\\Theta', 'vartheta': '\\vartheta',
    'iota': '\\iota', 'kappa': '\\kappa',
    'lambda_': '\\lambda',  # Note: 'lambda' is Python keyword, use lambda_ 
    'Lambda': '\\Lambda', 
    'mu': '\\mu', 'nu': '\\nu', 'xi': '\\xi', 'Xi': '\\Xi',
    # Note: 'pi' and 'e' are math constants, not Greek letters in our context
    'Pi': '\\Pi', 'varpi': '\\varpi',
    'rho': '\\rho', 'varrho': '\\varrho',
    'sigma': '\\sigma', 'Sigma': '\\Sigma', 'varsigma': '\\varsigma',
    'tau': '\\tau', 
    'upsilon': '\\upsilon', 'Upsilon': '\\Upsilon',
    'phi': '\\phi', 'Phi': '\\Phi', 'varphi': '\\varphi',
    'chi': '\\chi', 
    'psi': '\\psi', 'Psi': '\\Psi',
    'omega': '\\omega', 'Omega': '\\Omega',
    # Common electrical engineering symbols
    'ohm': '\\Omega',
    'inf': '\\infty',
}


def name_to_latex(name: str) -> str:
    r"""
    Convert a Python variable name to LaTeX notation.
    
    Handles:
    - Greek letters: alpha -> \alpha
    - Subscripts: x_1 -> x_{1}, V_in -> V_{in}
    - Combined: Gamma_L -> \Gamma_{L}
    """
    # Handle subscript pattern
    if '_' in name:
        parts = name.split('_', 1)
        base = GREEK_LETTERS.get(parts[0], parts[0])
        subscript = GREEK_LETTERS.get(parts[1], parts[1])
        return f"{base}_{{{subscript}}}"
    
    return GREEK_LETTERS.get(name, name)


def expr_to_latex(node: ast.expr, namespace: Optional[Dict[str, Any]] = None) -> str:
    """
    Convert an AST expression node to LaTeX string (symbolic form).
    """
    if namespace is None:
        namespace = {}
    
    if isinstance(node, ast.Constant):
        val = node.value
        if isinstance(val, float):
            # Handle special floats
            if val == float('inf'):
                return r'\infty'
            elif val == float('-inf'):
                return r'-\infty'
            # Format nicely
            return f"{val:g}"
        return str(val)
    
    elif isinstance(node, ast.Name):
        return name_to_latex(node.id)
    
    elif isinstance(node, ast.BinOp):
        left = expr_to_latex(node.left, namespace)
        right = expr_to_latex(node.right, namespace)
        
        # Check if we need parentheses for precedence
        left_paren = isinstance(node.left, ast.BinOp) and \
                     isinstance(node.left.op, (ast.Add, ast.Sub)) and \
                     isinstance(node.op, (ast.Mult, ast.Div, ast.Pow))
        right_paren = isinstance(node.right, ast.BinOp) and \
                      isinstance(node.right.op, (ast.Add, ast.Sub)) and \
                      isinstance(node.op, (ast.Mult, ast.Div, ast.Pow))
        
        if left_paren:
            left = f"\\left({left}\\right)"
        if right_paren and not isinstance(node.op, ast.Div):
            right = f"\\left({right}\\right)"
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            # Smart multiplication: use \cdot or implicit
            return f"{left} \\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.FloorDiv):
            return f"\\left\\lfloor\\frac{{{left}}}{{{right}}}\\right\\rfloor"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
        elif isinstance(node.op, ast.Mod):
            return f"{left} \\mod {right}"
        else:
            return f"{left} \\text{{op}} {right}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = expr_to_latex(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        elif isinstance(node.op, ast.UAdd):
            return f"+{operand}"
        elif isinstance(node.op, ast.Not):
            return f"\\neg {operand}"
        return operand
    
    elif isinstance(node, ast.Call):
        # Get function name
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr
        else:
            func_name = "func"
        
        args = [expr_to_latex(arg, namespace) for arg in node.args]
        
        # Special function rendering
        if func_name == 'sqrt':
            return f"\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\left|{args[0]}\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'cot', 'sec', 'csc'):
            return f"\\{func_name}\\left({args[0]}\\right)"
        elif func_name in ('sinh', 'cosh', 'tanh'):
            return f"\\{func_name}\\left({args[0]}\\right)"
        elif func_name in ('asin', 'arcsin'):
            return f"\\arcsin\\left({args[0]}\\right)"
        elif func_name in ('acos', 'arccos'):
            return f"\\arccos\\left({args[0]}\\right)"
        elif func_name in ('atan', 'arctan'):
            return f"\\arctan\\left({args[0]}\\right)"
        elif func_name == 'atan2':
            return f"\\arctan\\left(\\frac{{{args[0]}}}{{{args[1]}}}\\right)"
        elif func_name == 'log':
            if len(args) == 1:
                return f"\\ln\\left({args[0]}\\right)"
            else:
                return f"\\log_{{{args[1]}}}\\left({args[0]}\\right)"
        elif func_name in ('ln', 'log'):
            return f"\\ln\\left({args[0]}\\right)"
        elif func_name == 'log10':
            return f"\\log_{{10}}\\left({args[0]}\\right)"
        elif func_name == 'log2':
            return f"\\log_{{2}}\\left({args[0]}\\right)"
        elif func_name == 'exp':
            return f"e^{{{args[0]}}}"
        elif func_name == 'pow':
            return f"{args[0]}^{{{args[1]}}}"
        elif func_name == 'max':
            return f"\\max\\left({', '.join(args)}\\right)"
        elif func_name == 'min':
            return f"\\min\\left({', '.join(args)}\\right)"
        elif func_name == 'sum':
            return f"\\sum {args[0]}"
        elif func_name == 'round':
            return args[0]  # Just show the value being rounded
        else:
            # Generic function
            return f"\\text{{{func_name}}}\\left({', '.join(args)}\\right)"
    
    elif isinstance(node, ast.Compare):
        left = expr_to_latex(node.left, namespace)
        result = left
        for op, comparator in zip(node.ops, node.comparators):
            right = expr_to_latex(comparator, namespace)
            if isinstance(op, ast.Eq):
                result += f" = {right}"
            elif isinstance(op, ast.NotEq):
                result += f" \\neq {right}"
            elif isinstance(op, ast.Lt):
                result += f" < {right}"
            elif isinstance(op, ast.Gt):
                result += f" > {right}"
            elif isinstance(op, ast.LtE):
                result += f" \\leq {right}"
            elif isinstance(op, ast.GtE):
                result += f" \\geq {right}"
        return result
    
    elif isinstance(node, ast.IfExp):
        # Ternary: a if condition else b
        test = expr_to_latex(node.test, namespace)
        body = expr_to_latex(node.body, namespace)
        orelse = expr_to_latex(node.orelse, namespace)
        return f"\\begin{{cases}} {body} & \\text{{if }} {test} \\\\ {orelse} & \\text{{otherwise}} \\end{{cases}}"
    
    elif isinstance(node, ast.Subscript):
        value = expr_to_latex(node.value, namespace)
        if isinstance(node.slice, ast.Constant):
            idx = node.slice.value
        else:
            idx = expr_to_latex(node.slice, namespace)
        return f"{value}_{{{idx}}}"
    
    elif isinstance(node, ast.List) or isinstance(node, ast.Tuple):
        elements = [expr_to_latex(elem, namespace) for elem in node.elts]
        return f"\\left[{', '.join(elements)}\\right]"
    
    # Fallback
    return f"\\text{{?}}"


def substitute_values(node: ast.expr, namespace: Dict[str, Any]) -> str:
    """
    Create LaTeX string with variable values substituted.
    """
    if isinstance(node, ast.Constant):
        val = node.value
        if isinstance(val, float):
            return f"{val:g}"
        return str(val)
    
    elif isinstance(node, ast.Name):
        val = namespace.get(node.id)
        if val is None:
            return name_to_latex(node.id)
        if isinstance(val, float):
            return f"{val:g}"
        return str(val)
    
    elif isinstance(node, ast.BinOp):
        left = substitute_values(node.left, namespace)
        right = substitute_values(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
        elif isinstance(node.op, ast.Mod):
            return f"{left} \\mod {right}"
        else:
            return f"{left} ? {right}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = substitute_values(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        return operand
    
    elif isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        else:
            func_name = "func"
        
        args = [substitute_values(arg, namespace) for arg in node.args]
        
        if func_name == 'sqrt':
            return f"\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\left|{args[0]}\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'exp'):
            return f"\\{func_name}\\left({args[0]}\\right)"
        else:
            return f"\\text{{{func_name}}}\\left({', '.join(args)}\\right)"
    
    return expr_to_latex(node, namespace)


def format_value(val: Any) -> str:
    """Format a computed value for LaTeX display."""
    if isinstance(val, complex):
        real = f"{val.real:g}" if val.real != 0 else ""
        imag_val = val.imag
        if imag_val == 1:
            imag = "j"
        elif imag_val == -1:
            imag = "-j"
        else:
            imag = f"{imag_val:g}j"
        
        if real and imag_val >= 0:
            return f"{real} + {imag}"
        elif real:
            return f"{real} {imag}"
        else:
            return imag
    elif isinstance(val, float):
        # Avoid floating point ugliness
        if abs(val - round(val)) < 1e-10:
            return str(int(round(val)))
        return f"{val:.6g}"
    elif isinstance(val, bool):
        return "\\text{True}" if val else "\\text{False}"
    else:
        return str(val)


def python_to_latex(code: str, 
                    show_symbolic: bool = True,
                    show_substitution: bool = True,
                    show_result: bool = True) -> Tuple[str, Dict[str, Any]]:
    """
    Main conversion function.
    
    Args:
        code: Python source code
        show_symbolic: Include symbolic form (e.g., x + y)
        show_substitution: Include numeric substitution (e.g., 5 + 10)
        show_result: Include final result (e.g., = 15)
    
    Returns:
        Tuple of (latex_string, namespace_dict)
    """
    tree = ast.parse(code)
    
    # Execution namespace with math functions
    namespace = {
        'sqrt': sqrt, 'abs': abs, 
        'sin': sin, 'cos': cos, 'tan': tan,
        'asin': asin, 'acos': acos, 'atan': atan,
        'sinh': sinh, 'cosh': cosh, 'tanh': tanh,
        'log': log, 'log10': log10, 'exp': exp, 
        'pi': pi, 'e': e,
        'j': 1j,  # Complex number support
        'max': max, 'min': min,
        'round': round,
        'pow': pow,
    }
    
    latex_lines = []
    simple_assignments = []  # Track which are simple (x = 5)
    
    for node in tree.body:
        # Only process simple assignments: var = expr
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                continue  # Skip tuple unpacking, etc.
            
            var_name = target.id
            expr = node.value
            
            # Execute to get the value
            try:
                exec(compile(ast.Module(body=[node], type_ignores=[]), '<calc>', 'exec'), namespace)
                value = namespace[var_name]
            except Exception as exc:
                # If execution fails, skip this line
                continue
            
            value_str = format_value(value)
            var_latex = name_to_latex(var_name)
            
            # Check if simple constant assignment
            is_simple = isinstance(expr, ast.Constant)
            simple_assignments.append(is_simple)
            
            if is_simple:
                # Simple: x = 5 -> x &= 5
                latex_lines.append(f"{var_latex} &= {value_str}")
            else:
                # Complex calculation
                parts = []
                
                if show_symbolic:
                    symbolic = expr_to_latex(expr, namespace)
                    parts.append(symbolic)
                
                if show_substitution:
                    substituted = substitute_values(expr, namespace)
                    # Only show if different from symbolic
                    if not show_symbolic or substituted != expr_to_latex(expr, namespace):
                        parts.append(substituted)
                
                if show_result:
                    parts.append(value_str)
                
                latex_lines.append(f"{var_latex} &= " + " = ".join(parts))
        
        # Augmented assignment: x += 5
        elif isinstance(node, ast.AugAssign):
            if not isinstance(node.target, ast.Name):
                continue
            
            var_name = node.target.id
            
            try:
                exec(compile(ast.Module(body=[node], type_ignores=[]), '<calc>', 'exec'), namespace)
                value = namespace[var_name]
            except:
                continue
            
            value_str = format_value(value)
            var_latex = name_to_latex(var_name)
            latex_lines.append(f"{var_latex} &= {value_str}")
            simple_assignments.append(True)
        
        # Silently ignore everything else:
        # - ast.Expr (print statements, bare expressions)
        # - ast.Import / ast.ImportFrom
        # - ast.FunctionDef
        # - ast.For / ast.While
        # - ast.If
        # - etc.
    
    # Build the aligned environment with smart spacing
    if latex_lines:
        result_lines = []
        for i, (line, is_simple) in enumerate(zip(latex_lines, simple_assignments)):
            if i > 0:
                # Add extra space before calculations (after simple assignments end)
                prev_simple = simple_assignments[i-1]
                if prev_simple and not is_simple:
                    result_lines.append("\\\\[10pt]")
                else:
                    result_lines.append("\\\\")
            result_lines.append(line)
        
        latex = "\\begin{aligned}\n" + "\n".join(result_lines) + "\n\\end{aligned}"
        return latex, namespace
    
    return "", namespace


def main():
    """CLI interface for testing."""
    if len(sys.argv) > 1:
        # Code passed as argument
        code = sys.argv[1].replace(';', '\n')
    else:
        # Read from stdin
        code = sys.stdin.read()
    
    try:
        latex, namespace = python_to_latex(code)
        print(latex)
    except SyntaxError as exc:
        print(f"Syntax Error: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()