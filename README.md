# Obsidian-VCalc

> ⚠️ **DEVELOPMENT STATUS: ALPHA**
> 
> This plugin is in early development and is **not production-ready**. Expect bugs, breaking changes, and missing features. Use at your own risk and always backup your vault before testing.

**VCalc** (Visual Calculations) is an Obsidian plugin that lets you write Python calculations in your notes and render them as beautiful LaTeX equations - similar to Jupyter notebooks but integrated into your Obsidian workflow.

---

## Features

- **Python to LaTeX**: Write Python code, get rendered mathematical equations
- **Symbolic + Numeric**: Shows the formula, substituted values, and final result
- **Variable Sets (vsets)**: Share variables between calculation blocks in the same note
- **Greek Letters**: Automatic conversion (`alpha` → α, `Gamma` → Γ)
- **Subscripts**: `x_1` renders as x₁, `Z_Load` renders as Z_Load
- **Sidebar Panel**: View all active variables in a dedicated panel
- **Collapsible LaTeX Source**: Copy raw LaTeX for use elsewhere

---

## Requirements

- **Obsidian** v1.0.0 or higher
- **Python 3** installed and accessible via command line
- **Desktop only** - does not work on mobile

---

## Installation (Manual)

Since this plugin is in development, it's not available in the Obsidian Community Plugins directory.

1. Download the latest release files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
   - `python_to_latex.py`

2. Create a folder in your vault:
   ```
   YourVault/.obsidian/plugins/obsidian-vcalc/
   ```

3. Copy all four files into that folder

4. In Obsidian: Settings → Community Plugins → Enable "VCalc"

5. Restart Obsidian or reload plugins

---

## Usage

### Basic Calculation Block

```markdown
> [!vcalc] My Calculation Title
> ```python
> # {vset:main}
> x = 5
> y = 10
> z = x + y
> ```
```

- `[!vcalc]` - The callout identifier
- `My Calculation Title` - Your custom title (displayed in the header)
- `# {vset:main}` - Links this block to a variable set (optional)

Click **Run** to execute and render the LaTeX output.

### Sharing Variables Between Blocks

Use the same vset name to share variables:

```markdown
> [!vcalc] Step 1: Define Parameters
> ```python
> # {vset:circuit}
> R = 100
> L = 0.01
> C = 1e-6
> ```

Some explanatory text...

> [!vcalc] Step 2: Calculate Resonance
> ```python
> # {vset:circuit}
> f_0 = 1 / (2 * pi * sqrt(L * C))
> ```
```

Run Step 1 first, then Step 2 will have access to R, L, and C.

### Supported Math Functions

```python
sqrt(x)      # Square root
abs(x)       # Absolute value
sin(x)       # Trigonometric functions
cos(x)
tan(x)
asin(x)      # Inverse trig
acos(x)
atan(x)
log(x)       # Natural logarithm
log10(x)     # Base-10 logarithm
exp(x)       # Exponential
pi           # 3.14159...
e            # 2.71828...
```

### Greek Letters

Variable names are automatically converted:

| Python | LaTeX |
|--------|-------|
| `alpha` | α |
| `beta` | β |
| `gamma` | γ |
| `Gamma` | Γ |
| `delta` | δ |
| `omega` | ω |
| `theta` | θ |
| `phi` | φ |
| `rho` | ρ |
| `sigma` | σ |
| ... | ... |

### Variables Sidebar

Click the **calculator icon** in the left ribbon to open the Variables panel. It shows:
- All active variable sets for the current note
- Variable names, values, and which block defined them
- Option to clear all variables

---

## Commands

- **Insert VCalc Block** - Inserts a template calculation block
- **Run VCalc Block** - Executes the block at cursor position
- **Open Variables Panel** - Opens the sidebar
- **Clear Variables for Current Note** - Resets all variables

---

## Known Limitations

- Variables are stored in memory only - they reset when you close/reopen a note
- Blocks must be run in order (no automatic dependency resolution)
- No support for loops, conditionals, or function definitions
- Complex numbers display may be inconsistent
- No mobile support

---

## Current Features (v0.6.0)

### Core Functionality

- **`[!vcalc]` Callout Syntax** - Clean integration with Obsidian's native callout system
- **Python Execution** - Write real Python code, get LaTeX output
- **Automatic LaTeX Conversion** - AST-based parsing converts Python expressions to properly formatted LaTeX
- **Greek Letter Support** - Use `alpha`, `beta`, `theta`, etc. in variable names → renders as α, β, θ
- **Subscript Handling** - `x_1`, `v_max` → renders as x₁, vₘₐₓ

### Variable Sets (VSet)

- **Shared Variables** - Define variables in one block, use them in another
- **Named Sets** - Organize calculations with `# {vset:main}`, `# {vset:circuit}`, etc.
- **Automatic Color Coding** - Each vset gets a unique color (green, blue, orange, purple, teal, pink, yellow, red)
- **Sidebar Panel** - View all variables with their values, types, and source blocks

### Display Options

|Setting|Description|
|---|---|
|Show Symbolic|Display the formula (e.g., `z = x + y`)|
|Show Substitution|Display values substituted (e.g., `z = 5 + 10`)|
|Show Result|Display final result (e.g., `z = 15`)|

### File Persistence

- **Save to File** - Persist LaTeX output to markdown for Reading View & PDF export
- **Clear from File** - Remove saved output with ✕ button or command
- **Auto-Save Option** - Automatically save on every run
- **Outdated Indicator** - Visual warning when saved output differs from current calculation
- **Smart Replacement** - Re-running updates existing saved output

### Commands

|Command|Description|
|---|---|
|Insert VCalc Block|Insert a template block|
|Run All VCalc Blocks|Execute all blocks in order|
|Save All LaTeX to File|Persist all outputs|
|Run & Save All|Execute and persist in one step|
|Clear All Saved LaTeX|Remove all persisted outputs|

### Appearance & Styling

**Global Settings:**

- Background Style: Default, Subtle, Solid, Transparent
- Compact Mode: Reduced padding for denser layouts
- Sync Accent with VSet: Match left border & title to vset color

**Per-Block Options:**

```python
# {vset:main, hidden, accent:vset, bg:transparent, compact}
```

|Option|Values|Description|
|---|---|---|
|`vset:name`|any identifier|Variable set name|
|`hidden`|flag|Hide code in editor & PDF export|
|`accent:vset`|flag|Sync border color with vset|
|`accent:default`|flag|Use default blue accent|
|`bg:transparent`|flag|No background|
|`bg:subtle`|flag|Very light background|
|`bg:solid`|flag|More visible background|
|`compact`|flag|Reduced padding|

### Math Functions Supported

- **Basic:** `+`, `-`, `*`, `/`, `**` (power), `%` (mod)
- **Functions:** `sqrt()`, `abs()`, `sin()`, `cos()`, `tan()`, `log()`, `log10()`, `exp()`
- **Inverse Trig:** `asin()`, `acos()`, `atan()`
- **Constants:** `pi`, `e`
- **Complex Numbers:** `j` for imaginary unit

---

## Planned Features (Roadmap)

### 🔢 Matrix Support

**Priority: High**

Support for matrix definitions, operations, and LaTeX rendering.

```python
# Planned syntax
A = Matrix([[1, 2], [3, 4]])
B = Matrix([[5, 6], [7, 8]])
C = A * B  # Matrix multiplication
det_A = det(A)  # Determinant
inv_A = A.inv()  # Inverse
```

**LaTeX Output:** $$A = \begin{pmatrix} 1 & 2 \ 3 & 4 \end{pmatrix}$$

**Library:** `sympy.Matrix` or `numpy`

---

### 📐 Unit Support

**Priority: High**

Physical calculations with automatic unit conversion and dimensional analysis.

```python
# Planned syntax
R = 8.314 * J/(mol*K)
T = 25 * degC
P = 101325 * Pa
n = 1 * mol
V = (n * R * T) / P
```

**LaTeX Output:** $$V = \frac{n \cdot R \cdot T}{P} = \frac{1,\text{mol} \cdot 8.314,\frac{\text{J}}{\text{mol·K}} \cdot 298.15,\text{K}}{101325,\text{Pa}} = 0.0245,\text{m}^3$$

**Library:** `pint`

**Features:**

- Automatic unit conversion
- Dimensional analysis errors
- SI and common engineering units
- Custom unit definitions

---

### 🔣 Symbolic Mathematics

**Priority: High**

Symbolic operations using SymPy for algebraic manipulation.

```python
# Planned syntax
x, y, m, b = symbols('x y m b')

# Define equation
eq = Eq(y, m*x + b)

# Solve for x
x_expr = solve(eq, x)  # → x = (y - b) / m

# Differentiation
f = x**3 + 2*x**2 - 5*x
df = diff(f, x)  # → 3x² + 4x - 5

# Integration
F = integrate(f, x)  # → x⁴/4 + 2x³/3 - 5x²/2 + C

# Simplification
expr = (x**2 - 1) / (x - 1)
simplified = simplify(expr)  # → x + 1
```

**LaTeX Output:** $$\frac{d}{dx}(x^3 + 2x^2 - 5x) = 3x^2 + 4x - 5$$

$$\int (x^3 + 2x^2 - 5x), dx = \frac{x^4}{4} + \frac{2x^3}{3} - \frac{5x^2}{2} + C$$

**Library:** `sympy`

**Features:**

- Symbol definition
- Equation solving / rearranging
- Differentiation & Integration
- Limits
- Series expansion
- Simplification

---

### 📈 2D Plots

**Priority: Medium**

Generate plots inline as SVG images.

```python
# Planned syntax
# {vset:main, plot}
x = linspace(0, 2*pi, 100)
y = sin(x)
plot(x, y, title="Sine Wave", xlabel="x", ylabel="sin(x)")
```

**Output:** Inline SVG rendered directly in the note

**Library:** `matplotlib` → SVG export

**Features:**

- Line plots
- Scatter plots
- Multiple series
- Labels and titles
- Grid options
- Custom colors

---

### 📊 3D Plots

**Priority: Low (Nice to have)**

3D surface and line plots.

```python
# Planned syntax
# {vset:main, plot3d}
x = linspace(-5, 5, 50)
y = linspace(-5, 5, 50)
X, Y = meshgrid(x, y)
Z = sin(sqrt(X**2 + Y**2))
surface(X, Y, Z)
```

**Library:** `matplotlib` 3D projection → SVG

**Note:** Lower priority as 3D plots are less common in typical calculations and more complex to render well as static images.

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Obsidian                          │
│  ┌───────────────────────────────────────────────┐  │
│  │              VCalc Plugin (TypeScript)         │  │
│  │  • Callout post-processor                      │  │
│  │  • Variable store (per-note, per-vset)         │  │
│  │  • Settings management                         │  │
│  │  • File persistence (save/clear LaTeX)         │  │
│  └───────────────────┬───────────────────────────┘  │
│                      │                               │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐  │
│  │           Python Subprocess                    │  │
│  │  • AST parsing                                 │  │
│  │  • Expression evaluation                       │  │
│  │  • LaTeX conversion                            │  │
│  │  • Variable extraction                         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Example Usage

### Basic Calculation

```markdown
> [!vcalc] Ohm's Law
> ```python
> # {vset:circuit}
> U = 12      # Voltage in V
> R = 470     # Resistance in Ω
> I = U / R   # Current
> ```
```

**Output:** $$U = 12$$ $$R = 470$$ $$I = \frac{U}{R} = \frac{12}{470} = 0.0255$$

### Multi-Block with Shared Variables

```markdown
> [!vcalc] Define Constants
> ```python
> # {vset:physics}
> g = 9.81
> m = 5
> ```

> [!vcalc] Calculate Energy
> ```python
> # {vset:physics}
> h = 10
> E_pot = m * g * h
> ```

---

_Created with ❤️ (and AI) for engineers, scientists, and students who want beautiful math in their notes._

---

## Contributing

This project is in early development. Bug reports, suggestions, and contributions are welcome!

---

## License

MIT License - Use at your own risk.

---

## Acknowledgments

Inspired by:
- [Jupyter Notebooks](https://jupyter.org/)
- [handcalcs](https://github.com/connorferster/handcalcs)
- [Obsidian Execute Code Plugin](https://github.com/twibiral/obsidian-execute-code)