import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVsetColorIndex,
  getVsetColor,
  clearNoteVariables,
  getVariables,
  setVariables,
  updateVariable,
} from './variable-store';
import { VariableStore, VSetColorMap } from '../types';
import { VSET_COLORS } from '../constants';

describe('Variable Store', () => {
  let variableStore: VariableStore;
  let vsetColors: VSetColorMap;

  beforeEach(() => {
    variableStore = {};
    vsetColors = {};
  });

  describe('getVsetColorIndex', () => {
    it('should assign color index 0 to first vset', () => {
      const index = getVsetColorIndex(vsetColors, 'note1.md', 'main');
      expect(index).toBe(0);
    });

    it('should assign sequential indices to multiple vsets', () => {
      const index1 = getVsetColorIndex(vsetColors, 'note1.md', 'main');
      const index2 = getVsetColorIndex(vsetColors, 'note1.md', 'physics');
      const index3 = getVsetColorIndex(vsetColors, 'note1.md', 'math');

      expect(index1).toBe(0);
      expect(index2).toBe(1);
      expect(index3).toBe(2);
    });

    it('should return same index for same vset on subsequent calls', () => {
      const index1 = getVsetColorIndex(vsetColors, 'note1.md', 'main');
      const index2 = getVsetColorIndex(vsetColors, 'note1.md', 'main');
      const index3 = getVsetColorIndex(vsetColors, 'note1.md', 'main');

      expect(index1).toBe(index2);
      expect(index2).toBe(index3);
    });

    it('should wrap indices when exceeding color palette size', () => {
      const numColors = VSET_COLORS.length;

      // Assign colors to more vsets than available colors
      for (let i = 0; i < numColors + 3; i++) {
        getVsetColorIndex(vsetColors, 'note1.md', `vset${i}`);
      }

      // The last vset should wrap around
      const lastIndex = getVsetColorIndex(vsetColors, 'note1.md', `vset${numColors + 2}`);
      expect(lastIndex).toBeLessThan(numColors);
    });

    it('should assign colors independently per note', () => {
      const index1 = getVsetColorIndex(vsetColors, 'note1.md', 'main');
      const index2 = getVsetColorIndex(vsetColors, 'note2.md', 'main');
      const index3 = getVsetColorIndex(vsetColors, 'note3.md', 'main');

      // Each note starts at index 0 for 'main' vset
      expect(index1).toBe(0);
      expect(index2).toBe(0);
      expect(index3).toBe(0);
    });

    it('should fill gaps in color indices', () => {
      // Manually assign non-sequential indices
      vsetColors['note1.md'] = {
        'vset1': 0,
        'vset2': 2, // Skip 1
        'vset3': 4, // Skip 3
      };

      // Next vset should get index 1 (first gap)
      const index = getVsetColorIndex(vsetColors, 'note1.md', 'vset4');
      expect(index).toBe(1);
    });

    it('should handle empty vsetColors map', () => {
      const emptyColors: VSetColorMap = {};
      const index = getVsetColorIndex(emptyColors, 'note1.md', 'main');

      expect(index).toBe(0);
      expect(emptyColors['note1.md']).toBeDefined();
      expect(emptyColors['note1.md']['main']).toBe(0);
    });

    it('should handle note with no vsets yet', () => {
      vsetColors['otherNote.md'] = { 'existing': 0 };

      const index = getVsetColorIndex(vsetColors, 'newNote.md', 'main');

      expect(index).toBe(0);
      expect(vsetColors['newNote.md']).toBeDefined();
    });

    it('should assign different colors to different vsets in same note', () => {
      const indices = new Set<number>();

      for (let i = 0; i < Math.min(5, VSET_COLORS.length); i++) {
        const index = getVsetColorIndex(vsetColors, 'note1.md', `vset${i}`);
        indices.add(index);
      }

      // All indices should be unique (up to palette size)
      expect(indices.size).toBe(Math.min(5, VSET_COLORS.length));
    });
  });

  describe('getVsetColor', () => {
    it('should return color object for vset', () => {
      const color = getVsetColor(vsetColors, 'note1.md', 'main');

      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('rgb');
      expect(typeof color.name).toBe('string');
      expect(typeof color.rgb).toBe('string');
    });

    it('should return consistent color for same vset', () => {
      const color1 = getVsetColor(vsetColors, 'note1.md', 'main');
      const color2 = getVsetColor(vsetColors, 'note1.md', 'main');

      expect(color1).toBe(color2); // Should be same reference from VSET_COLORS
      expect(color1.name).toBe(color2.name);
      expect(color1.rgb).toBe(color2.rgb);
    });

    it('should return different colors for different vsets', () => {
      const color1 = getVsetColor(vsetColors, 'note1.md', 'main');
      const color2 = getVsetColor(vsetColors, 'note1.md', 'physics');

      // Should have different colors (unless palette is exhausted)
      if (VSET_COLORS.length > 1) {
        expect(color1.name).not.toBe(color2.name);
      }
    });

    it('should return first color from palette for first vset', () => {
      const color = getVsetColor(vsetColors, 'note1.md', 'main');
      const expectedColor = VSET_COLORS[0];

      expect(color).toBe(expectedColor);
    });

    it('should handle multiple notes independently', () => {
      const color1 = getVsetColor(vsetColors, 'note1.md', 'main');
      const color2 = getVsetColor(vsetColors, 'note2.md', 'main');

      // Both should get first color
      expect(color1).toBe(VSET_COLORS[0]);
      expect(color2).toBe(VSET_COLORS[0]);
    });
  });

  describe('clearNoteVariables', () => {
    it('should clear variables for specific note', () => {
      variableStore['note1.md'] = {
        main: {
          x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
        },
      };

      clearNoteVariables(variableStore, 'note1.md');

      expect(variableStore['note1.md']).toBeUndefined();
    });

    it('should not affect other notes', () => {
      variableStore['note1.md'] = {
        main: {
          x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
        },
      };
      variableStore['note2.md'] = {
        main: {
          y: { value: 10, type: 'int', blockTitle: 'Block 2', timestamp: Date.now() },
        },
      };

      clearNoteVariables(variableStore, 'note1.md');

      expect(variableStore['note1.md']).toBeUndefined();
      expect(variableStore['note2.md']).toBeDefined();
      expect(variableStore['note2.md'].main.y.value).toBe(10);
    });

    it('should handle clearing non-existent note', () => {
      clearNoteVariables(variableStore, 'nonexistent.md');

      expect(variableStore['nonexistent.md']).toBeUndefined();
    });

    it('should clear all vsets for a note', () => {
      variableStore['note1.md'] = {
        main: {
          x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
        },
        physics: {
          force: { value: 10, type: 'float', blockTitle: 'Block 2', timestamp: Date.now() },
        },
        math: {
          pi: { value: 3.14, type: 'float', blockTitle: 'Block 3', timestamp: Date.now() },
        },
      };

      clearNoteVariables(variableStore, 'note1.md');

      expect(variableStore['note1.md']).toBeUndefined();
    });
  });

  describe('getVariables', () => {
    it('should return variables for existing vset', () => {
      const vars = {
        x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
        y: { value: 10, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
      };
      variableStore['note1.md'] = { main: vars };

      const result = getVariables(variableStore, 'note1.md', 'main');

      expect(result).toBe(vars);
      expect(result.x.value).toBe(5);
      expect(result.y.value).toBe(10);
    });

    it('should return empty object for non-existent vset', () => {
      const result = getVariables(variableStore, 'note1.md', 'nonexistent');

      expect(result).toEqual({});
    });

    it('should return empty object for non-existent note', () => {
      const result = getVariables(variableStore, 'nonexistent.md', 'main');

      expect(result).toEqual({});
    });

    it('should handle note with multiple vsets', () => {
      variableStore['note1.md'] = {
        main: {
          x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
        },
        physics: {
          force: { value: 10, type: 'float', blockTitle: 'Block 2', timestamp: Date.now() },
        },
      };

      const mainVars = getVariables(variableStore, 'note1.md', 'main');
      const physicsVars = getVariables(variableStore, 'note1.md', 'physics');

      expect(mainVars.x.value).toBe(5);
      expect(physicsVars.force.value).toBe(10);
    });

    it('should return empty object for empty vset', () => {
      variableStore['note1.md'] = { main: {} };

      const result = getVariables(variableStore, 'note1.md', 'main');

      expect(result).toEqual({});
    });
  });

  describe('setVariables', () => {
    it('should set variables for new vset', () => {
      const vars = {
        x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
        y: { value: 10, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
      };

      setVariables(variableStore, 'note1.md', 'main', vars);

      expect(variableStore['note1.md']).toBeDefined();
      expect(variableStore['note1.md'].main).toBe(vars);
      expect(variableStore['note1.md'].main.x.value).toBe(5);
      expect(variableStore['note1.md'].main.y.value).toBe(10);
    });

    it('should overwrite existing variables', () => {
      const oldVars = {
        x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
      };
      const newVars = {
        y: { value: 10, type: 'int', blockTitle: 'Block 2', timestamp: Date.now() },
      };

      setVariables(variableStore, 'note1.md', 'main', oldVars);
      setVariables(variableStore, 'note1.md', 'main', newVars);

      expect(variableStore['note1.md'].main).toBe(newVars);
      expect(variableStore['note1.md'].main.x).toBeUndefined();
      expect(variableStore['note1.md'].main.y.value).toBe(10);
    });

    it('should create note entry if not exists', () => {
      const vars = {
        x: { value: 5, type: 'int', blockTitle: 'Block 1', timestamp: Date.now() },
      };

      setVariables(variableStore, 'newNote.md', 'main', vars);

      expect(variableStore['newNote.md']).toBeDefined();
      expect(variableStore['newNote.md'].main).toBe(vars);
    });

    it('should not affect other vsets in same note', () => {
      variableStore['note1.md'] = {
        physics: {
          force: { value: 10, type: 'float', blockTitle: 'Block 1', timestamp: Date.now() },
        },
      };

      const mathVars = {
        pi: { value: 3.14, type: 'float', blockTitle: 'Block 2', timestamp: Date.now() },
      };

      setVariables(variableStore, 'note1.md', 'math', mathVars);

      expect(variableStore['note1.md'].physics.force.value).toBe(10);
      expect(variableStore['note1.md'].math.pi.value).toBe(3.14);
    });

    it('should handle empty variable set', () => {
      setVariables(variableStore, 'note1.md', 'main', {});

      expect(variableStore['note1.md'].main).toEqual({});
    });
  });

  describe('updateVariable', () => {
    it('should add variable to new vset', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'x', 5, 'int', 'Block 1');

      expect(variableStore['note1.md']).toBeDefined();
      expect(variableStore['note1.md'].main).toBeDefined();
      expect(variableStore['note1.md'].main.x).toBeDefined();
      expect(variableStore['note1.md'].main.x.value).toBe(5);
      expect(variableStore['note1.md'].main.x.type).toBe('int');
      expect(variableStore['note1.md'].main.x.blockTitle).toBe('Block 1');
      expect(variableStore['note1.md'].main.x.timestamp).toBeTypeOf('number');
    });

    it('should update existing variable', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'x', 5, 'int', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'x', 10, 'int', 'Block 1');

      expect(variableStore['note1.md'].main.x.value).toBe(10);
    });

    it('should add multiple variables to same vset', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'x', 5, 'int', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'y', 10, 'int', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'z', 15, 'int', 'Block 1');

      expect(Object.keys(variableStore['note1.md'].main)).toHaveLength(3);
      expect(variableStore['note1.md'].main.x.value).toBe(5);
      expect(variableStore['note1.md'].main.y.value).toBe(10);
      expect(variableStore['note1.md'].main.z.value).toBe(15);
    });

    it('should handle different value types', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'num', 42, 'int', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'str', 'hello', 'str', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'bool', true, 'bool', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'none', null, 'NoneType', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'arr', [1, 2, 3], 'list', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'obj', { a: 1 }, 'dict', 'Block 1');

      expect(variableStore['note1.md'].main.num.value).toBe(42);
      expect(variableStore['note1.md'].main.str.value).toBe('hello');
      expect(variableStore['note1.md'].main.bool.value).toBe(true);
      expect(variableStore['note1.md'].main.none.value).toBeNull();
      expect(variableStore['note1.md'].main.arr.value).toEqual([1, 2, 3]);
      expect(variableStore['note1.md'].main.obj.value).toEqual({ a: 1 });
    });

    it('should create note and vset if not exist', () => {
      updateVariable(variableStore, 'newNote.md', 'newVset', 'x', 5, 'int', 'Block 1');

      expect(variableStore['newNote.md']).toBeDefined();
      expect(variableStore['newNote.md'].newVset).toBeDefined();
      expect(variableStore['newNote.md'].newVset.x.value).toBe(5);
    });

    it('should not affect other variables in same vset', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'x', 5, 'int', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'y', 10, 'int', 'Block 1');

      expect(variableStore['note1.md'].main.x.value).toBe(5);
      expect(variableStore['note1.md'].main.y.value).toBe(10);
    });

    it('should update timestamp on each update', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'x', 5, 'int', 'Block 1');
      const timestamp1 = variableStore['note1.md'].main.x.timestamp;

      // Wait a bit to ensure different timestamp
      const now = Date.now();
      while (Date.now() === now) { /* wait */ }

      updateVariable(variableStore, 'note1.md', 'main', 'x', 10, 'int', 'Block 1');
      const timestamp2 = variableStore['note1.md'].main.x.timestamp;

      expect(timestamp2).toBeGreaterThan(timestamp1);
    });

    it('should handle variables with different block titles', () => {
      updateVariable(variableStore, 'note1.md', 'main', 'x', 5, 'int', 'Block 1');
      updateVariable(variableStore, 'note1.md', 'main', 'y', 10, 'int', 'Block 2');

      expect(variableStore['note1.md'].main.x.blockTitle).toBe('Block 1');
      expect(variableStore['note1.md'].main.y.blockTitle).toBe('Block 2');
    });
  });
});
