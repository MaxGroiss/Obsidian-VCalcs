# Changelog

All notable changes to VCalc will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Comprehensive JSDoc documentation across all source files
- Documentation standard guide (ClaudeDocs/DOCUMENTATION_STANDARD.md)
- MIT License file

### Changed
- Improved code organization and inline documentation

## [0.8.0] - 2025-12-06

### Added
- Custom VCalc icons for sidebar panels (vcalc-variables, vcalc-editor)
- Button visibility settings in plugin settings
- VCalc logo as visual indicator in UI
- Disconnect button in editor panel to unlink from blocks

### Changed
- Visual improvements to callout blocks and editor panel
- Improved UI consistency across light and dark themes

### Fixed
- Editor panel now correctly uses the VCalc Editor icon

## [0.7.0] - 2025-12-05

### Added
- Quality of life improvements for editor workflow
- Disconnect capability to manually unlink editor from blocks

### Fixed
- Various UI polish and interaction improvements

## [0.6.0] - 2025-12-04

### Added
- Comprehensive test suite (237 tests covering all modules)
- Tests for type guards, variable store, parser, converter, and editor view

### Changed
- Improved code reliability through test-driven development

## [0.5.0] - 2025-12-03

### Fixed
- **Critical**: Pyodide now works correctly in Electron/Obsidian environment
  - Fixed by setting `process.browser = true` to force browser API usage
  - See: https://github.com/pyodide/pyodide/discussions/2248

### Added
- Phase 1-5 development milestones completed
- Pre-polish refinements and stability improvements

## [0.4.0] - 2025-12-02

### Added
- VCalc Editor sidebar panel with CodeMirror integration
- Block selector dropdown to switch between blocks
- Real-time code editing with sync to callout blocks
- Autocomplete for math functions, constants, and Greek letters
- Block settings panel (vset, background, compact mode, accent sync)
- Rename block functionality via modal dialog

### Changed
- Major refactoring for cleaner architecture
- Separated concerns into distinct modules

### Fixed
- Various rendering and synchronization issues

## [0.3.0] - 2025-12-02

### Added
- Visual features for callout blocks
- Code collapse/expand functionality
- Export to PDF improvements
- Variable badge coloring based on vset

### Changed
- Improved LaTeX output formatting
- Better visual distinction between variable sets

## [0.2.0] - 2025-12-01

### Added
- LaTeX output persistence to markdown files
- Save/Clear LaTeX buttons on callout blocks
- HTML comment markers for saved output (`<!-- vcalc-output -->`)
- Variable set (vset) support for sharing variables between blocks
- Color-coded vset badges in Variables panel

### Fixed
- LaTeX printing and formatting issues

## [0.1.0] - 2025-12-01

### Added
- Initial release of VCalc plugin
- `[!vcalc]` callout blocks for Python calculations
- Pyodide integration for browser-based Python execution
- LaTeX rendering via MathJax
- Variables sidebar panel showing all defined variables
- Support for math functions (sqrt, sin, cos, tan, log, exp, etc.)
- Support for math constants (pi, e)
- Greek letter variable names (alpha, beta, gamma, etc.)
- Subscript notation (x_1, alpha_max)
- Display options (symbolic, substitution, result)

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 0.8.0 | 2025-12-06 | Custom icons, button visibility settings |
| 0.7.0 | 2025-12-05 | Editor disconnect, QoL improvements |
| 0.6.0 | 2025-12-04 | Test suite (237 tests) |
| 0.5.0 | 2025-12-03 | Pyodide/Electron fix |
| 0.4.0 | 2025-12-02 | VCalc Editor panel |
| 0.3.0 | 2025-12-02 | Visual features, PDF export |
| 0.2.0 | 2025-12-01 | LaTeX persistence, vsets |
| 0.1.0 | 2025-12-01 | Initial release |
