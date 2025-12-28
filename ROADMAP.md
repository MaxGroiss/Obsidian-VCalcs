# VCalc Roadmap

A living document tracking planned features, improvements, and long-term vision for the VCalc Obsidian plugin.

**Last Updated**: December 2024
**Current Version**: 0.8.0

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ | Completed |
| 🚧 | In Progress |
| 📋 | Planned (Next) |
| 💭 | Under Consideration |
| ❌ | Rejected/Deferred |

| Priority | Description |
|----------|-------------|
| 🔴 P0 | Critical - Blocking release |
| 🟠 P1 | High - Should have |
| 🟡 P2 | Medium - Nice to have |
| 🟢 P3 | Low - Future consideration |

---

## Completed Features ✅

### Core Engine
- ✅ Python execution via Pyodide (WebAssembly - no Python install required)
- ✅ AST-based LaTeX conversion
- ✅ Variable injection/extraction between blocks
- ✅ Greek letters (α, β, γ, Γ, Δ, etc.)
- ✅ Subscript notation (x_1, F_gravity)
- ✅ Math functions (sin, cos, sqrt, log, exp, etc.)
- ✅ Math constants (pi, e)
- ✅ Three-stage output (symbolic → substitution → result)
- ✅ Display options (toggle symbolic/substitution/result)

### User Interface
- ✅ `[!vcalc]` callout blocks with Run/Clear buttons
- ✅ Toggle code visibility (hidden option)
- ✅ Copy LaTeX button
- ✅ VSet color-coded badges
- ✅ CodeMirror 6 Editor panel with syntax highlighting
- ✅ Variables sidebar panel
- ✅ Block selector dropdown
- ✅ Auto-complete (functions, constants, Greek letters, vset variables)
- ✅ Keyboard shortcuts (Ctrl+Enter to run)
- ✅ Custom VCalc icons

### Variable Management
- ✅ Per-note, per-vset variable storage
- ✅ Variable sharing between blocks in same vset
- ✅ "Last definer wins" cleanup strategy (sourceBlockId tracking)
- ✅ Variables panel with copy-to-clipboard

### File Persistence
- ✅ Save LaTeX output to markdown (HTML comment markers)
- ✅ "Outdated" indicators when code changes
- ✅ Bulk operations (Run All, Save All, Clear All)
- ✅ Auto-save option

### Editor UX (Phase 1-2)
- ✅ Post-run focus stays in editor (not note)
- ✅ Block rename functionality
- ✅ Status bar feedback (execution time, variable count)
- ✅ Block settings panel (vset, background, compact, accent, hidden)
- ✅ Disconnect button
- ✅ Simplified error messages

### Code Quality
- ✅ 237 unit tests (parser, converter, variable-store, type-guards, editor-view)
- ✅ Comprehensive JSDoc documentation
- ✅ TypeScript strict mode
- ✅ Pyodide migration (Electron compatibility fixed)

---

## Short-Term Roadmap (Next Release)

### 📋 Math Reference Panel 🟠 P1
**Effort**: Medium | **Value**: High

Add a collapsible "Math Help" panel in the editor:
- Searchable reference of available functions
- Greek letter quick reference
- Click-to-insert code templates
- Show LaTeX preview on hover

```
┌─ Math Reference ─────────────────────────┐
│ 🔍 Search: [________________]            │
│                                          │
│ ▼ Basic Operations                       │
│   x * y      → x · y                     │
│   x / y      → fraction                  │
│   x ** n     → x^n                       │
│                                          │
│ ▼ Functions                              │
│   sqrt(x)    → √x                        │
│   sin(x)     → sin(x)                    │
│   log(x)     → ln(x)                     │
│                                          │
│ ▼ Greek Letters (click to insert)        │
│   alpha → α    beta → β    gamma → γ     │
└──────────────────────────────────────────┘
```

### 📋 Click-to-Insert Templates 🟡 P2
**Effort**: Low | **Value**: Medium

Pre-built templates for common formulas:
- Quadratic formula
- Pythagorean theorem
- Newton's second law (F = ma)
- Kinetic energy (KE = ½mv²)
- Ohm's law (V = IR)
- User-defined custom templates (future)

### 📋 Keyboard Shortcuts Help 🟡 P2
**Effort**: Low | **Value**: Medium

Display available shortcuts in tooltip or help panel:
- `Ctrl/Cmd + Enter` - Run code
- `Ctrl/Cmd + S` - Save to file
- `Tab` - Accept autocomplete

---

## Medium-Term Roadmap (v1.0)

### 💭 Matrix Support 🔴 P0
**Effort**: High | **Value**: Very High

Enable matrix/array calculations with LaTeX matrix rendering:

```python
A = [[1, 2], [3, 4]]
B = [[5, 6], [7, 8]]
C = np.dot(A, B)
# Renders as LaTeX matrix
```

**Requirements**:
- NumPy integration in Pyodide
- Matrix LaTeX formatting (\begin{bmatrix}...\end{bmatrix})
- Determinant, inverse, eigenvalue display

### 💭 Unit Handling 🔴 P0
**Effort**: Very High | **Value**: Very High

Physical units with automatic conversion:

```python
F = 100 * N       # 100 Newtons
m = 10 * kg       # 10 kilograms
a = F / m         # Result: 10 m/s²
```

**Approach Options**:
1. Pint library (Python)
2. Custom lightweight unit system
3. Comment-based annotations (simpler)

**Renders as**:
```
F = 100 \, \text{N}
m = 10 \, \text{kg}
a = \frac{F}{m} = \frac{100 \, \text{N}}{10 \, \text{kg}} = 10 \, \text{m/s}^2
```

### 💭 Symbolic Math 🟠 P1
**Effort**: Very High | **Value**: High

Algebraic manipulation using SymPy:

```python
from sympy import symbols, diff, integrate, simplify
x = symbols('x')
expr = x**2 + 2*x + 1
derivative = diff(expr, x)     # 2x + 2
simplified = simplify(expr)    # (x + 1)²
```

**Features**:
- Differentiation
- Integration
- Equation solving
- Simplification
- Expansion

### 💭 Plotting 🟡 P2
**Effort**: High | **Value**: Medium

Generate plots and embed as images:

```python
import matplotlib.pyplot as plt
x = [1, 2, 3, 4, 5]
y = [1, 4, 9, 16, 25]
plt.plot(x, y)
# Converts to SVG and embeds in note
```

**Challenges**:
- Matplotlib in Pyodide
- SVG embedding in callout
- Interactive vs static plots

---

## Long-Term Vision (v2.0+)

### 💭 Dependency Graph Visualization 🟢 P3

Visual representation of variable dependencies:
- Which blocks define which variables
- Execution order based on dependencies
- Circular dependency detection

### 💭 Code Snippets Library 🟢 P3

User-defined reusable snippets:
- Personal snippet library
- Import/export collections
- Community snippet sharing

### 💭 Export Functionality 🟢 P3

Export calculations to various formats:
- Standalone HTML page
- PDF with calculations
- Jupyter notebook (.ipynb)
- LaTeX document

### 💭 LaTeX Template System 🟢 P3

Customizable output formatting:
- Per-domain templates (physics, engineering, finance)
- User-defined templates
- Significant figures control
- Scientific notation preferences

### 💭 Real-time Collaboration 🟢 P3

Live collaboration features (requires Obsidian Sync):
- Shared variable sets
- Real-time variable updates
- Conflict resolution

### 💭 Mobile Support 🟢 P3

Full functionality on mobile devices:
- Already possible with Pyodide (no Python install needed)
- UI optimization for touch
- Performance tuning for mobile

---

## Rejected/Deferred Ideas ❌

### ❌ Python Subprocess Mode
**Reason**: Security concerns, Pyodide provides better sandbox

### ❌ Variable Persistence Across Sessions
**Reason**: Hidden state complexity, version control issues
**Alternative**: Explicit export/import commands

### ❌ Full Jupyter Compatibility
**Reason**: Scope creep, different target audience
**Alternative**: Focus on lightweight calculations

---

## Contributing

Want to help build these features? Here's how:

1. **Pick an item** from the roadmap
2. **Open an issue** to discuss approach
3. **Submit a PR** with tests and documentation

Priority for contributors:
1. Bug fixes (always welcome)
2. Documentation improvements
3. Test coverage
4. P1/P2 features from roadmap

---

## Feedback

Have a feature request not on this list?

1. **Check existing issues** on GitHub
2. **Open a new issue** with:
   - Clear description of the feature
   - Use case / why it's needed
   - Proposed implementation (if you have ideas)

We prioritize features based on:
- User demand (issue upvotes)
- Implementation complexity
- Alignment with VCalc's vision

---

*This roadmap is subject to change based on user feedback and development priorities.*
