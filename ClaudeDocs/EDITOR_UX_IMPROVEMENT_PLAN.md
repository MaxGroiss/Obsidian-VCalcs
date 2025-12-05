# VCalc Editor UX Improvement Plan

## Vision

Transform the VCalc editor from a basic code input into a **professional math-focused editing experience** that guides users in writing mathematical expressions, provides convenient controls for block settings, and delivers a polished, intuitive UX.

---

## Current State Analysis

### What Works Well
- CodeMirror integration with Python syntax highlighting
- Auto-completion for math functions, constants, Greek letters
- Real-time mirror sync showing edits in the note
- Auto-save with dirty indicator
- Block selection dropdown

### Pain Points Identified
1. **Post-Run Focus Issue**: After clicking Run, cursor moves to code block in note - user can't see rendered output
2. **No Parameter UI**: Block options (vset, hidden, accent, bg, compact) require manual text editing
3. **No Rename Functionality**: Can't rename blocks from the editor
4. **Limited Math Guidance**: No help for writing complex expressions (matrices, integrals, etc.)
5. **No Execution Feedback in Editor**: Must check the note to see results/errors
6. **Basic Toolbar**: Missing professional polish and organization

---

## Improvement Phases

### Phase 1: Critical Bug Fixes & Quick Wins ✅ COMPLETED
**Priority: High | Effort: Low**
**Status: Implemented December 2024**

#### 1.1 Fix Post-Run Focus Issue ✅
- After execution, focus stays in the editor (not the note's code block)
- Scrolls to show rendered output using `scrollIntoView()`
- Editor DOM reference preserved and restored after run button click

**Implementation:** `runCurrentBlock()` in [editor-view.ts](src/views/editor-view.ts)

#### 1.2 Add Block Rename in Editor ✅
- Added "✏️" rename button in the selector row
- Opens a modal dialog (RenameModal class) for entering new title
- Updates the callout title line in the markdown file
- Refreshes dropdown to show new name

**Implementation:**
- `renameCurrentBlock()`, `promptForTitle()`, `updateBlockTitle()` methods
- `RenameModal` class extending Obsidian's Modal

#### 1.3 Improve Status Bar Feedback ✅
- Shows execution result: success (✓) or error (✗)
- Displays execution time (ms or seconds)
- Shows variable count in the current vset
- Color-coded status bar (green for success, red for error)
- "Running..." indicator during execution

**Implementation:**
- `updateExecutionStatus()` method with time/variable formatting
- `getVariableCount()` to count variables in current vset
- `checkForExecutionError()` to detect errors in output
- CSS classes: `.vcalc-status-success`, `.vcalc-status-error`

**Tests:** 29 unit tests added in [editor-view.test.ts](src/views/editor-view.test.ts)

---

### Phase 2: Block Settings Panel
**Priority: High | Effort: Medium**

#### 2.1 Settings Panel UI
Add a collapsible settings panel below the block selector:

```
┌─────────────────────────────────────────────┐
│ [Block Dropdown ▼] [●] [↻]  [⚙ Settings]   │
├─────────────────────────────────────────────┤
│ ┌─ Block Settings ────────────────────────┐ │
│ │ Title: [_______________] [✏️ Rename]    │ │
│ │                                         │ │
│ │ Variable Set: [main     ▼]              │ │
│ │   ○ Create new: [_______]               │ │
│ │                                         │ │
│ │ Appearance:                             │ │
│ │   Background: [Default ▼]               │ │
│ │   □ Compact Mode                        │ │
│ │   □ Sync Accent with VSet               │ │
│ │   □ Hidden (code only)                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [CodeMirror Editor]                         │
│                                             │
│ [▶ Run] [💾 Save]                           │
└─────────────────────────────────────────────┘
```

#### 2.2 Settings Functionality
- **Variable Set Selector**: Dropdown with existing vsets + "Create new" option
- **Background Style**: Default, Transparent, Subtle, Solid
- **Checkboxes**: Compact, Accent Sync, Hidden
- **Live Preview**: Changes reflect immediately in note mirror

#### 2.3 Implementation Details
- Settings stored in the `# vcalc:` options line
- Use `buildOptionsLine()` from parser to reconstruct
- Debounced save to prevent excessive writes

---

### Phase 3: Math Expression Helper
**Priority: Medium | Effort: Medium-High**

#### 3.1 Math Reference Panel
Add a collapsible "Math Help" panel or sidebar tab:

```
┌─ Math Reference ─────────────────────────┐
│ 🔍 Search: [________________]            │
│                                          │
│ ▼ Basic Operations                       │
│   x + y      Addition                    │
│   x - y      Subtraction                 │
│   x * y      Multiplication → x · y      │
│   x / y      Division → fraction         │
│   x ** n     Power → x^n                 │
│                                          │
│ ▼ Functions                              │
│   sqrt(x)    Square root → √x            │
│   abs(x)     Absolute value → |x|        │
│   sin(x)     Sine → sin(x)               │
│   cos(x)     Cosine → cos(x)             │
│   log(x)     Natural log → ln(x)         │
│   log10(x)   Base-10 log → log₁₀(x)      │
│   exp(x)     Exponential → eˣ            │
│                                          │
│ ▼ Greek Letters                          │
│   alpha → α    beta → β    gamma → γ     │
│   delta → δ    theta → θ   lambda → λ    │
│   pi → π       sigma → σ   omega → ω     │
│                                          │
│ ▼ Subscripts & Formatting                │
│   x_1 → x₁                               │
│   x_max → x_{max}                        │
│   F_gravity → F_{gravity}                │
│                                          │
│ ▼ Complex Expressions (click to insert)  │
│   [Quadratic Formula]                    │
│   [Pythagorean Theorem]                  │
│   [Newton's Second Law]                  │
│   [Kinetic Energy]                       │
└──────────────────────────────────────────┘
```

#### 3.2 Click-to-Insert Templates
Clicking an expression inserts template code:
- **Quadratic Formula**: `x = (-b + sqrt(b**2 - 4*a*c)) / (2*a)`
- **Pythagorean**: `c = sqrt(a**2 + b**2)`
- **F = ma**: `F = m * a`
- **KE**: `KE = 0.5 * m * v**2`

#### 3.3 Searchable Reference
- Fuzzy search through all expressions
- Filter by category
- Show LaTeX preview on hover

---

### Phase 4: Enhanced Editor Chrome
**Priority: Medium | Effort: Medium**

#### 4.1 Improved Toolbar Design
```
┌─────────────────────────────────────────────────────┐
│ VCalc Editor                              [─][□][×] │
├─────────────────────────────────────────────────────┤
│ Block: [2. Force Calculation [physics] ▼] [↻]      │
│                                                     │
│ ┌─ Quick Actions ─────────────────────────────────┐ │
│ │ [▶ Run] [💾 Save] │ [⚙] [📖 Help] [📋 Vars]    │ │
│ └─────────────────────────────────────────────────┘ │
```

#### 4.2 Keyboard Shortcuts Display
Show available shortcuts in a tooltip or help panel:
- `Ctrl/Cmd + Enter` - Run code
- `Ctrl/Cmd + S` - Save to file
- `Ctrl/Cmd + /` - Toggle comment
- `Ctrl/Cmd + D` - Duplicate line
- `Tab` - Accept autocomplete

#### 4.3 Better Visual Hierarchy
- Clearer section separation
- Consistent spacing and padding
- Professional color scheme matching Obsidian themes
- Subtle animations for state changes

---

### Phase 5: Execution Feedback
**Priority: Medium | Effort: Medium**

#### 5.1 Inline Results Preview
After execution, show a preview in the editor:

```
┌─────────────────────────────────────────────┐
│ [CodeMirror Editor]                         │
│ a = 5                                       │
│ b = 3                                       │
│ c = sqrt(a**2 + b**2)                       │
├─────────────────────────────────────────────┤
│ ✓ Executed successfully                     │
│ ┌─ Output Preview ────────────────────────┐ │
│ │ a = 5                                   │ │
│ │ b = 3                                   │ │
│ │ c = √(5² + 3²) = √(25 + 9) = 5.831     │ │
│ └─────────────────────────────────────────┘ │
│ Variables: a=5, b=3, c=5.831                │
└─────────────────────────────────────────────┘
```

#### 5.2 Error Display
Show errors inline rather than just in notices:
```
┌─────────────────────────────────────────────┐
│ ✗ Execution Error                           │
│ ┌─ Error ─────────────────────────────────┐ │
│ │ Line 3: NameError: 'undefined_var'      │ │
│ │ is not defined                          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### 5.3 Variable Inspector
Show variables created/modified by the block:
```
┌─ Variables Created ──────────────────────┐
│ Name    │ Value  │ Type   │ VSet        │
│─────────┼────────┼────────┼─────────────│
│ a       │ 5      │ int    │ physics     │
│ b       │ 3      │ int    │ physics     │
│ c       │ 5.831  │ float  │ physics     │
└──────────────────────────────────────────┘
```

---

### Phase 6: Advanced Features (Future)
**Priority: Low | Effort: High**

#### 6.1 Multi-Block View
- Split view showing multiple blocks
- Drag to reorder blocks in note
- Batch operations (run all, save all)

#### 6.2 Code Snippets Library
- User-defined snippets
- Import/export snippet collections
- Community snippet sharing

#### 6.3 Syntax Validation
- Real-time Python syntax checking
- Highlight undefined variables
- Suggest fixes for common errors

#### 6.4 Version History
- Track changes to blocks
- Restore previous versions
- Diff view between versions

---

## Implementation Priority Order

### Immediate (This Sprint)
1. **Fix Post-Run Focus Issue** - Critical UX bug
2. **Add Block Rename** - High user value, low effort
3. **Basic Settings Panel** - VSet selector, appearance options

### Short-Term (Next Sprint)
4. **Math Reference Panel** - Core differentiator
5. **Improved Toolbar** - Professional polish
6. **Execution Feedback** - Better error display

### Medium-Term
7. **Click-to-Insert Templates** - Power user feature
8. **Keyboard Shortcuts Help** - Discoverability
9. **Variable Inspector** - Debugging aid

### Long-Term (Backlog)
10. Multi-block view
11. Snippets library
12. Syntax validation
13. Version history

---

## Technical Considerations

### File Structure Changes
```
src/views/
├── editor-view.ts          # Main editor (refactor)
├── editor-toolbar.ts       # NEW: Toolbar component
├── editor-settings.ts      # NEW: Settings panel
├── editor-math-help.ts     # NEW: Math reference
└── editor-results.ts       # NEW: Results preview
```

### CSS Organization
```
styles.css additions:
- .vcalc-editor-settings-panel
- .vcalc-editor-math-help
- .vcalc-editor-results-preview
- .vcalc-editor-toolbar-improved
```

### State Management
- Editor state: current block, dirty flag, settings panel open/closed
- Consider extracting to a dedicated state manager if complexity grows

---

## Success Metrics

1. **Usability**: User can set block parameters without editing raw text
2. **Discoverability**: New users find math reference helpful
3. **Efficiency**: Fewer clicks/keystrokes to accomplish common tasks
4. **Polish**: Editor feels native to Obsidian's aesthetic
5. **Reliability**: No focus issues, no lost work, clear feedback

---

## Next Steps

1. Review and approve this plan
2. Create GitHub issues for each phase
3. Start with Phase 1 (bug fixes)
4. Iterate based on user feedback

---

**Document Version**: 1.1
**Created**: December 2024
**Last Updated**: December 2024
**Status**: Phase 1 Complete, Phase 2+ Pending

### Changelog

#### v1.1 (December 2024)
- Phase 1 implemented and tested
- 29 unit tests added for editor view utilities
- Documentation updated with implementation details
