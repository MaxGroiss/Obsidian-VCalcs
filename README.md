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

## Roadmap / Future Ideas

- [ ] "Run All" button to execute all blocks in order
- [ ] Automatic dependency detection
- [ ] Persistent variables (save to file)
- [ ] Units support (e.g., meters, seconds)
- [ ] Better error messages
- [ ] Export to PDF/Word
- [ ] Settings panel for customization

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