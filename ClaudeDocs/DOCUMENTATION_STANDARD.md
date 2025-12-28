# VCalc Documentation Standard

## Overview

This document establishes the documentation standards for the VCalc Obsidian plugin. As an open-source project, exceptional documentation is critical for:

- **Contributors**: Understanding the codebase quickly
- **Maintainers**: Making informed decisions about changes
- **Users**: Understanding features and configuration
- **Future You**: Remembering why decisions were made

---

## Philosophy

### 1. Document the "Why", Not Just the "What"

```typescript
// BAD: Describes what the code does (obvious from reading it)
/** Adds two numbers */
function add(a: number, b: number): number { ... }

// GOOD: Explains why this exists and when to use it
/**
 * Combines base damage with modifier bonuses.
 * Used in the combat calculation pipeline after resistance is applied.
 */
function add(a: number, b: number): number { ... }
```

### 2. Assume the Reader is Competent but Unfamiliar

- Don't explain basic TypeScript/JavaScript
- Do explain domain-specific concepts (vsets, block options, Pyodide)
- Do explain non-obvious design decisions

### 3. Keep Documentation Close to Code

- Prefer JSDoc over separate documentation files
- Update docs when you update code (same commit)
- Use `@see` to link related concepts

### 4. Examples Are Worth a Thousand Words

- Include `@example` blocks for complex functions
- Show realistic use cases, not trivial ones

---

## JSDoc Standards

### File Headers

Every `.ts` file should start with a file-level JSDoc comment:

```typescript
/**
 * @fileoverview Variable storage and management for VCalc.
 *
 * This module provides the in-memory variable store that tracks all variables
 * across notes and variable sets (vsets). Variables are scoped by note path
 * and vset name, allowing blocks to share state within a calculation context.
 *
 * @module stores/variable-store
 * @see {@link types.ts} for VariableStore type definitions
 *
 * @example
 * // Store a variable from a calculation block
 * updateVariable(store, 'notes/physics.md', 'main', 'velocity', 9.8, 'float', 'Block 1');
 *
 * // Retrieve variables for a vset
 * const vars = getVariables(store, 'notes/physics.md', 'main');
 */
```

### Interfaces and Types

Document all interfaces with descriptions for each property:

```typescript
/**
 * Information about a stored variable in the calculation context.
 *
 * Variables are created when a VCalc block executes an assignment statement.
 * They persist in memory until the note is closed or explicitly cleared.
 */
export interface VariableInfo {
    /**
     * The computed value of the variable.
     * Can be a number, string, boolean, array, or null.
     * Complex numbers are stored as strings (e.g., "(3+4j)").
     */
    value: VariableValue;

    /**
     * Python type name of the value (e.g., 'int', 'float', 'complex', 'list').
     * Used for display in the Variables panel.
     */
    type: string;

    /**
     * Human-readable title of the block that defined this variable.
     * Displayed in the Variables panel to help users trace variable origins.
     */
    blockTitle: string;

    /**
     * Unique ID of the block that last defined this variable.
     * Used for the "last definer wins" cleanup strategy - when a block is
     * re-run, variables it previously defined are cleared before adding new ones.
     * Null for variables injected programmatically (e.g., from external sources).
     */
    sourceBlockId: string | null;

    /**
     * Unix timestamp (ms) when this variable was last updated.
     * Used for debugging and potential future features (e.g., variable history).
     */
    timestamp: number;
}
```

### Functions

Use full JSDoc with all applicable tags:

```typescript
/**
 * Removes all variables that were defined by a specific block.
 *
 * This implements the "last definer wins" cleanup strategy: before a block
 * adds its new variables, we remove any variables it previously defined.
 * This ensures that if a user deletes a variable assignment from their code
 * and re-runs the block, the variable is properly removed from the store.
 *
 * Variables defined by other blocks are not affected, even if they have
 * the same name (ownership transfers to the most recent definer).
 *
 * @param variableStore - The global variable store object
 * @param notePath - Path to the note containing the block (e.g., 'folder/note.md')
 * @param vset - Name of the variable set (e.g., 'main', 'physics')
 * @param blockId - Unique 8-character ID of the block (e.g., 'abc12345')
 *
 * @example
 * // Before re-running a block, clean up its old variables
 * removeBlockVariables(store, 'notes/calc.md', 'main', 'abc12345');
 *
 * // Then add the new variables from execution
 * updateVariable(store, 'notes/calc.md', 'main', 'x', 10, 'int', 'My Block', 'abc12345');
 *
 * @see {@link updateVariable} for adding variables with block ownership
 */
export function removeBlockVariables(
    variableStore: VariableStore,
    notePath: string,
    vset: string,
    blockId: string
): void {
```

### Classes

Document the class, constructor, and all public methods:

```typescript
/**
 * Singleton manager for Pyodide (Python WebAssembly) execution.
 *
 * Pyodide is loaded lazily on first calculation to avoid slowing down
 * Obsidian startup. The instance is shared across all VCalc blocks to
 * avoid redundant loading (~2-3 seconds per load).
 *
 * ## Electron Compatibility
 *
 * Obsidian runs in Electron, which exposes a `process` global that makes
 * Pyodide think it's running in Node.js. We set `process.browser = true`
 * to force browser API usage. See: https://github.com/pyodide/pyodide/discussions/2248
 *
 * ## Usage
 *
 * ```typescript
 * const executor = PyodideExecutor.getInstance();
 *
 * // Optional: Show loading UI
 * executor.setLoadCallbacks(
 *     () => showLoadingNotice(),
 *     () => hideLoadingNotice()
 * );
 *
 * // Execute Python code
 * const result = await executor.pythonToLatexWithVars(code, existingVars, options);
 * ```
 *
 * @see {@link generateConverterCodeWithVars} for the Python code template
 */
export class PyodideExecutor {
    /**
     * Private constructor - use {@link getInstance} instead.
     * Enforces singleton pattern.
     */
    private constructor() {}

    /**
     * Get the singleton PyodideExecutor instance.
     * Creates the instance on first call (lazy initialization).
     *
     * @returns The shared PyodideExecutor instance
     */
    static getInstance(): PyodideExecutor {
```

### Constants

Group related constants and document the group:

```typescript
/**
 * Timing constants for UI interactions and async operations.
 *
 * All values are in milliseconds unless otherwise noted.
 * These values have been tuned through user testing to balance
 * responsiveness with stability (avoiding race conditions).
 */
export const TIMING = {
    /**
     * Delay between running blocks in "Run All" command.
     * Prevents UI freezing and allows DOM updates between executions.
     */
    INTER_BLOCK_DELAY_MS: 100,

    /**
     * Debounce delay for auto-saving editor changes.
     * Prevents excessive file writes while user is actively typing.
     * Set to 2.5s based on typical typing pause patterns.
     */
    IDLE_SAVE_DELAY_MS: 2500,

    // ... etc
} as const;
```

### Private/Internal Functions

Still document, but mark as internal:

```typescript
/**
 * Builds Python code to inject existing variables into the execution namespace.
 *
 * Converts JavaScript values to Python literals that can be exec'd.
 * Handles strings, numbers, booleans, null (→ None), and JSON-serializable objects.
 *
 * @internal This is an implementation detail of {@link pythonToLatexWithVars}
 * @param existingVars - Variables to inject from the current vset
 * @returns Python code string with variable assignments
 */
private buildVarInjection(existingVars: VariableSet): string {
```

---

## JSDoc Tags Reference

### Required Tags

| Tag | When to Use |
|-----|-------------|
| `@param` | All function parameters |
| `@returns` | All functions that return a value (except void) |
| `@throws` | Functions that can throw errors |
| `@example` | Complex functions, public APIs |

### Recommended Tags

| Tag | When to Use |
|-----|-------------|
| `@see` | Reference related functions, types, or external docs |
| `@since` | Features added after v1.0 |
| `@deprecated` | Functions scheduled for removal |
| `@internal` | Implementation details not for external use |
| `@async` | Async functions (implied by return type, but adds clarity) |

### VCalc-Specific Tags

| Tag | When to Use |
|-----|-------------|
| `@module` | File headers to identify the module |
| `@fileoverview` | File headers for high-level description |

---

## Code Comments

### Inline Comments

Use sparingly, only when the code isn't self-explanatory:

```typescript
// BAD: Obvious from the code
// Loop through all variables
for (const varName of Object.keys(vars)) {

// GOOD: Explains non-obvious behavior
// Skip math constants (pi, e) - they're injected by the Python runtime
if (MATH_CONSTANTS.includes(varName)) continue;
```

### TODO Comments

Use a consistent format that's searchable:

```typescript
// TODO(username): Description of what needs to be done
// TODO(feature): Implement matrix support when SymPy is added
// TODO(bug): Handle edge case when vset name contains spaces
// TODO(perf): Consider caching parsed AST for repeated executions
```

### HACK/FIXME Comments

For temporary solutions or known issues:

```typescript
// HACK: Pyodide doesn't support top-level await in our context,
// so we wrap everything in an async IIFE. Remove when Pyodide 0.27+ is adopted.

// FIXME: This can fail silently if the DOM re-renders during execution.
// Need to add retry logic with exponential backoff.
```

---

## Type Documentation

### Prefer Descriptive Type Names

```typescript
// BAD: Generic name
type Callback = () => void;

// GOOD: Purpose is clear from name
type LoadCompleteCallback = () => void;
type VariableUpdateHandler = (varName: string, value: VariableValue) => void;
```

### Document Type Aliases

```typescript
/**
 * Valid value types that can be stored as calculation variables.
 *
 * - `number`: Integer or floating-point results
 * - `string`: Text values or complex number representations
 * - `boolean`: Logical values from comparisons
 * - `number[]` / `string[]`: Array results (e.g., from NumPy operations)
 * - `null`: Explicit null assignments
 * - `object`: Structured data (rare, mainly for future extensibility)
 */
export type VariableValue = number | string | boolean | number[] | string[] | null | object;
```

### Discriminated Unions

Document each variant:

```typescript
/**
 * Result of a block parsing operation.
 */
type ParseResult =
    | { success: true; options: BlockOptions; code: string }
    | { success: false; error: string; line: number };
```

---

## Documentation for Obsidian-Specific Code

### Lifecycle Methods

```typescript
/**
 * Called when the plugin is loaded by Obsidian.
 *
 * ## Initialization Order
 * 1. Load saved settings from disk
 * 2. Register custom icons (vcalc-variables, vcalc-editor)
 * 3. Set up Pyodide loading callbacks
 * 4. Register sidebar views (Variables, Editor)
 * 5. Add ribbon icons
 * 6. Register markdown post-processor for [!vcalc] callouts
 * 7. Register commands
 * 8. Add settings tab
 *
 * @override Plugin.onload
 */
async onload(): Promise<void> {
```

### Post-Processors

```typescript
/**
 * Markdown post-processor for VCalc callout blocks.
 *
 * Called by Obsidian whenever markdown is rendered. Finds [!vcalc] callouts
 * and transforms them into interactive calculation blocks with:
 * - Run/Clear/Copy buttons
 * - LaTeX output area
 * - Code visibility toggle
 *
 * ## DOM Structure Created
 * ```
 * .callout[data-callout="vcalc"]
 * ├── .callout-title
 * │   └── .callout-title-inner
 * ├── .callout-content
 * │   ├── pre > code (the Python code)
 * │   └── .vcalc-output (LaTeX rendering)
 * └── .vcalc-controls
 *     ├── button.vcalc-run-btn
 *     ├── button.vcalc-toggle-btn
 *     └── ...
 * ```
 *
 * @param element - The DOM element to process (may contain multiple callouts)
 * @param context - Obsidian's markdown post-processor context
 */
private processCalculationCallouts(element: HTMLElement, context: MarkdownPostProcessorContext): void {
```

---

## README and User Documentation

### Structure

1. **Title and Badges** - Name, version, status badges
2. **One-Line Description** - What it does in one sentence
3. **Screenshot/GIF** - Show, don't tell
4. **Features** - Bullet list of capabilities
5. **Installation** - Step-by-step instructions
6. **Quick Start** - Get running in 2 minutes
7. **Usage Guide** - Detailed feature documentation
8. **Configuration** - All settings explained
9. **FAQ/Troubleshooting** - Common issues
10. **Contributing** - (When ready for contributions)
11. **License** - MIT

### Tone

- Direct and concise
- Second person ("you can...", "your notes...")
- Active voice
- Present tense

---

## Changelog Format

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to VCalc will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New feature description

### Changed
- Change description

### Fixed
- Bug fix description

### Deprecated
- Feature that will be removed

### Removed
- Feature that was removed

### Security
- Security fix description

## [0.7.1] - 2024-12-15

### Fixed
- Editor panel now maintains connection when Obsidian re-renders DOM
- Variables panel correctly shows sourceBlockId for cleanup tracking

### Added
- Custom VCalc icons for sidebar panels (vcalc-variables, vcalc-editor)
```

---

## Examples of Exceptional Documentation

### From This Codebase

See [type-guards.ts](../src/utils/type-guards.ts) for excellent JSDoc examples:
- Full `@param` and `@returns` tags
- `@example` blocks with realistic code
- Clear descriptions of edge cases

### External References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - Clear, progressive disclosure
- [Obsidian API Docs](https://docs.obsidian.md/) - Good plugin-specific examples
- [Pyodide Docs](https://pyodide.org/en/stable/) - Technical depth with accessibility

---

## Checklist for New Code

Before committing, verify:

- [ ] File has `@fileoverview` header
- [ ] All exported functions have JSDoc
- [ ] All exported interfaces/types have JSDoc
- [ ] Complex logic has inline comments explaining "why"
- [ ] `@param` tags for all parameters
- [ ] `@returns` tag if function returns a value
- [ ] `@throws` tag if function can throw
- [ ] `@example` for public API functions
- [ ] `@see` links to related code where helpful
- [ ] No commented-out code (delete it, git remembers)
- [ ] TODOs have owner and context

---

## Documentation Debt Tracking

When documentation is incomplete, add to this list:

### Priority 1 (Core Functionality)
- [ ] `main.ts` - Plugin entry, lifecycle, core methods
- [ ] `editor-view.ts` - Complex UI, needs architecture docs
- [ ] `types.ts` - All interfaces need property docs

### Priority 2 (Supporting Modules)
- [ ] `constants.ts` - Add @fileoverview, document each constant group
- [ ] `variable-store.ts` - Add @fileoverview, full function docs
- [ ] `settings.ts` - Document settings interface

### Priority 3 (Utilities)
- [ ] `converter.ts` - Document Python code generation
- [ ] `messages.ts` - Group and document message constants
- [ ] `variables-view.ts` - Document UI components

---

*Document Version: 1.0*
*Created: December 2024*
*Last Updated: December 2024*
