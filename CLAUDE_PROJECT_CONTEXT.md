# VCalc - Obsidian Visual Calculations Plugin

## Project Overview

**VCalc** is an Obsidian plugin that enables visual, LaTeX-rendered calculations within markdown notes. Users write Python-like code in special callout blocks, and the plugin executes the code, renders results as beautiful LaTeX mathematics, and maintains shared variables across blocks.

### Core Vision

Transform Obsidian into a powerful tool for engineers, scientists, and students who need to:
- Document calculations with full mathematical notation
- Share variables between calculation blocks
- See live results rendered as LaTeX
- Export calculations for reports/papers

### Target Users

- Engineers doing design calculations
- Students solving physics/math problems
- Scientists documenting experimental analysis
- Anyone who wants "Mathcad in Markdown"

---

## Current Version: 0.7.1

### What Works

1. **VCalc Callout Blocks** - Write calculations in `> [!vcalc]` callouts
2. **Python Execution** - Executes Python-subset code via Pyodide (WebAssembly)
3. **LaTeX Rendering** - Converts results to beautiful mathematical notation
4. **Variable Sharing** - Variables persist across blocks via "vsets" (variable sets)
5. **Editor Panel** - Dedicated CodeMirror 6 editor in sidebar
6. **Variables Panel** - View all variables and their values
7. **File Persistence** - Save LaTeX output below blocks in markdown

---

## Architecture

### File Structure

```
obsidian-calcblocks/
├── src/
│   ├── main.ts                 # Plugin entry, commands, post-processor
│   ├── types.ts                # TypeScript interfaces
│   ├── constants.ts            # Shared constants, ID generation
│   ├── settings.ts             # Plugin settings tab
│   ├── callout/
│   │   └── parser.ts           # Parse vcalc blocks, extract options
│   ├── python/
│   │   ├── executor.ts         # Pyodide execution engine
│   │   └── converter.ts        # Python AST → LaTeX conversion
│   ├── stores/
│   │   └── variable-store.ts   # In-memory variable management
│   ├── file/
│   │   └── latex-persistence.ts # Save/load LaTeX to markdown
│   └── views/
│       ├── variables-view.ts   # Sidebar variables panel
│       └── editor-view.ts      # Sidebar CodeMirror editor
├── styles.css                  # All plugin styles
├── manifest.json               # Obsidian plugin manifest
├── package.json                # NPM dependencies
├── tsconfig.json               # TypeScript config
└── esbuild.config.mjs          # Build configuration
```

### Key Components

#### 1. Block Format

```markdown
> [!vcalc] Block Title
> ```python
> # vcalc: id=abc123 vset=main
> U = 12        # Voltage
> R = 470       # Resistance  
> I = U / R     # Current
> ```
```

**Options Line Format** (first line of code):
```python
# vcalc: id=abc123 vset=main hidden accent=vset bg=transparent compact
```

| Option | Values | Description |
|--------|--------|-------------|
| `id` | 8-char alphanumeric | Unique block identifier (auto-generated) |
| `vset` | string | Variable set name for sharing variables |
| `hidden` | flag | Hide the code block, show only results |
| `accent` | `vset`, `output`, `both`, `none` | Which parts get colored accent |
| `bg` | `transparent`, `default` | Background style |
| `compact` | flag | Reduce vertical spacing |

#### 2. Variable Sets (vsets)

Variables are scoped by:
- **Note path** - Variables don't leak between notes
- **Vset name** - Blocks with same vset share variables

```
variableStore = {
  "path/to/note.md": {
    "main": { U: {value: 12, latex: "12"}, R: {...} },
    "circuit2": { ... }
  }
}
```

#### 3. Execution Flow

```
User clicks "Run" on block
    ↓
parseVsetFromCodeBlock() extracts code + options
    ↓
pythonToLatexWithVars() executes via Pyodide
    ↓
Results rendered as LaTeX via MathJax
    ↓
Variables stored in variableStore
    ↓
Other blocks with same vset can access variables
```

#### 4. Editor Panel Architecture

The editor panel was the most complex feature. Key challenges solved:

**Problem**: Obsidian re-renders DOM frequently, breaking element references.

**Solution**: ID-based block identification
- Each block has unique `id` in options line
- ID stored as `data-vcalc-id` attribute on DOM element
- Lookup by ID (parsing code) instead of storing DOM references

**Problem**: `getActiveViewOfType(MarkdownView)` returns null when editor panel is focused.

**Solution**: Find MarkdownView by file path:
```typescript
private getMarkdownContainer(): HTMLElement | null {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile) return null;
    
    // Find by file path, not "active" view
    const leaves = this.plugin.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
        const view = leaf.view as MarkdownView;
        if (view.file?.path === activeFile.path) {
            return view.containerEl;
        }
    }
    return null;
}
```

**DOM Mirror System**:
- When editing, original `<pre>` is hidden
- Mirror element shows live preview
- 300ms interval checks if mirror still exists (survives re-renders)
- On disconnect, mirror removed, original restored

---

## Features in Detail

### Implemented ✅

#### Core Calculation Engine
- [x] Python subset execution via Pyodide
- [x] Support for math functions (sin, cos, sqrt, log, etc.)
- [x] Support for math constants (pi, e, tau)
- [x] Greek letter variables (α, β, γ, etc.)
- [x] NumPy arrays and operations
- [x] Complex expressions with proper order of operations
- [x] Comments (# style)
- [x] Multi-line calculations

#### LaTeX Rendering
- [x] Automatic Python → LaTeX conversion
- [x] Fraction rendering for division
- [x] Superscripts for exponents
- [x] Square root symbols
- [x] Greek letter conversion
- [x] Subscript support (x_1, R_load)
- [x] Units in results (configurable)

#### Variable Management
- [x] Variable sets (vsets) for scoping
- [x] Cross-block variable sharing
- [x] Variables panel showing all values
- [x] Per-note variable isolation
- [x] Color-coded vsets (up to 6 colors)

#### Editor Panel
- [x] CodeMirror 6 with Python syntax highlighting
- [x] Autocomplete for functions, constants, Greek letters
- [x] Autocomplete for vset variables
- [x] Live DOM mirror preview
- [x] Auto-save after 2.5s idle
- [x] Keyboard shortcuts (Ctrl+Enter = Run, Ctrl+S = Save)
- [x] Block selector dropdown
- [x] Dirty indicator for unsaved changes
- [x] ID-based block tracking (survives re-renders)

#### UI/UX
- [x] Custom ribbon icons (V with badge)
- [x] Run/Clear buttons on each block
- [x] Copy LaTeX button
- [x] Save to file button
- [x] Collapsible code blocks
- [x] Accent colors for vsets
- [x] Dark/light theme support

#### Persistence
- [x] Save LaTeX output below blocks in markdown
- [x] Survives Obsidian restart
- [x] Clear saved output commands

### Partially Implemented 🟡

#### Block Options
- [x] `id` - block identifier
- [x] `vset` - variable set
- [x] `hidden` - hide code (partially working)
- [ ] `accent` - color options (defined but not fully implemented)
- [ ] `bg` - background options (defined but not fully implemented)
- [ ] `compact` - spacing (defined but not fully implemented)

#### Migration
- [x] New format parser (`# vcalc: id=x vset=y`)
- [x] Old format parser (`# {vset:main}`) - backward compatible
- [ ] Auto-migration of old blocks to new format

### Not Yet Implemented ❌

#### Planned Features
- [ ] Error highlighting in editor (Python syntax validation)
- [ ] Quick-connect icon on blocks (click to edit in panel)
- [ ] Multi-file variable references
- [ ] Duplicate ID detection and regeneration
- [ ] Block reordering support
- [ ] Drag-and-drop blocks
- [ ] Greatly improve Math/LaTeX handling (Matrix, Complex and Real Values)
 

#### Nice to Have
- [ ] Symbolic math (SymPy integration)
- [ ] Plotting (matplotlib → SVG)
- [ ] Unit conversion library
- [ ] Custom function definitions
- [ ] Import from other notes
- [ ] Templates for common calculations

---

## Technical Details

### Dependencies

```json
{
  "dependencies": {
    "obsidian": "latest"
  },
  "devDependencies": {
    "@codemirror/autocomplete": "^6.18.6",
    "@codemirror/commands": "^6.8.1", 
    "@codemirror/lang-python": "^6.1.7",
    "@codemirror/language": "^6.11.0",
    "@codemirror/state": "^6.5.2",
    "@codemirror/view": "^6.36.5",
    "@types/node": "^16.11.6",
    "esbuild": "0.17.3",
    "typescript": "4.7.4"
  }
}
```

### Pyodide Integration

Pyodide is loaded from CDN on first calculation:
```typescript
const pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"
});
await pyodide.loadPackage(['numpy']);
```

Python code is executed in a sandboxed environment with:
- `math` module (all functions)
- `numpy` as `np`
- Previous vset variables injected

### ID Generation

```typescript
function generateVCalcId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}
```

8 characters, lowercase alphanumeric = ~2.8 trillion combinations.

### CSS Classes

Key classes in `styles.css`:
- `.vcalc-output` - LaTeX output container
- `.vcalc-controls` - Button bar
- `.vcalc-editor-container` - Editor panel wrapper
- `.vcalc-editor-mirror` - Live preview overlay
- `.vcalc-variables-view` - Variables panel
- `.callout[data-callout="vcalc"]` - Main block styling

---

## Known Issues & Limitations

### Current Bugs
1. **Hidden blocks** - `hidden` option partially working, may show flash of code
2. **Accent colors** - Not fully applied to all elements
3. **Multiple blocks same ID** - No duplicate detection yet

### Limitations
1. **Pyodide load time** - First calculation takes 2-3 seconds (loading WASM)
2. **No offline** - Requires internet for Pyodide CDN
3. **Memory** - Large NumPy arrays may cause issues
4. **No symbolic math** - Only numeric evaluation

### Edge Cases
1. **Same file in multiple panes** - May cause issues with editor panel
2. **Reading mode** - Editor panel works but mirror may not appear
3. **Mobile** - Not tested, likely won't work (Pyodide)

---

## Development Notes

### Building

```bash
npm install
npm run build    # Production build
npm run dev      # Watch mode
```

### Testing

Currently manual testing only. Test scenarios:
1. Create block, run calculation
2. Multiple blocks with same vset
3. Switch between blocks in editor
4. Edit, wait for auto-save, verify file updated
5. Close/reopen Obsidian, verify saved LaTeX persists
6. Old format blocks still work

### Code Conventions

- TypeScript strict mode
- Interfaces in `types.ts`
- Constants in `constants.ts`
- One component per file in `views/`
- Async/await for all file operations
- Console.log sparingly (only for errors)

### Obsidian API Notes

- `MarkdownPostProcessor` runs on every DOM update
- `registerView` for sidebar panels
- `addRibbonIcon` for left sidebar buttons
- `addCommand` for command palette
- `workspace.getActiveFile()` returns current note
- `workspace.getLeavesOfType()` finds all views of type

---

## Roadmap

### v0.8.0 - Polish
- [ ] Fix hidden blocks
- [ ] Implement accent/bg options fully
- [ ] Add quick-connect button on blocks
- [ ] Better error messages in output

### v0.9.0 - Robustness
- [ ] Duplicate ID detection
- [ ] Session persistence
- [ ] Error highlighting in editor
- [ ] Unit tests

### v1.0.0 - Release Ready
- [ ] Documentation
- [ ] Settings UI improvements
- [ ] Performance optimization
- [ ] Mobile compatibility check

### Future
- [ ] SymPy symbolic math
- [ ] Plotting support
- [ ] Multi-note variables
- [ ] Export functionality

---

## Contributing

### File Locations for Common Tasks

| Task | Files |
|------|-------|
| Add new block option | `types.ts`, `parser.ts`, `main.ts` |
| Change LaTeX output | `converter.ts` |
| Editor behavior | `editor-view.ts` |
| Styling | `styles.css` |
| New command | `main.ts` (onload) |
| New sidebar panel | `views/`, `main.ts`, `constants.ts` |

### Debugging Tips

1. Open DevTools: `Ctrl+Shift+I`
2. Filter console by "VCalc"
3. Check `data-vcalc-id` attributes in Elements panel
4. Verify `variableStore` in console: `app.plugins.plugins['obsidian-vcalc'].variableStore`

---

## Session History

### Key Decisions Made

1. **Callout-based blocks** over code fence processor (better Obsidian integration)
2. **Pyodide** over custom parser (full Python support, NumPy)
3. **ID-based tracking** over index-based (survives DOM re-renders)
4. **vsets** for variable scoping (flexible, intuitive)
5. **CodeMirror 6** for editor (modern, extensible)
6. **DOM mirror** for live preview (works with Obsidian's rendering)

### Major Refactors

1. **v0.5→v0.6**: Added variable persistence, vset colors
2. **v0.6→v0.7**: Added editor panel with CodeMirror
3. **v0.7→v0.7.1**: Fixed DOM reference issues with ID-based lookups

---

## Contact & Resources

- **Obsidian API**: https://docs.obsidian.md/
- **Pyodide**: https://pyodide.org/
- **CodeMirror 6**: https://codemirror.net/
- **Lucide Icons**: https://lucide.dev/icons/

---

*Last updated: December 2024 - v0.7.1*
