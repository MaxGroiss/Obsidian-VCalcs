import { vi } from 'vitest';

/**
 * Mock Obsidian API classes and utilities
 */

export class MockApp {
  vault = new MockVault();
}

export class MockVault {
  adapter = new MockFileAdapter();

  getAbstractFileByPath(path: string) {
    return { path };
  }
}

export class MockFileAdapter {
  private files = new Map<string, string>();

  async read(path: string): Promise<string> {
    return this.files.get(path) || '';
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  // Helper for tests
  setFile(path: string, content: string) {
    this.files.set(path, content);
  }

  clearAll() {
    this.files.clear();
  }
}

export class MockNotice {
  message: string;
  duration: number;

  constructor(message: string, duration?: number) {
    this.message = message;
    this.duration = duration ?? 5000;
  }
}

export class MockPlugin {
  app = new MockApp();
  manifest = {
    id: 'vcalc-test',
    name: 'VCalc Test',
    version: '1.0.0',
  };

  loadData = vi.fn();
  saveData = vi.fn();
  addCommand = vi.fn();
  registerMarkdownPostProcessor = vi.fn();
  registerEditorExtension = vi.fn();
}

export class MockMarkdownView {
  file = null;
  editor = null;

  getViewType() {
    return 'markdown';
  }
}

export class MockComponent {
  load = vi.fn();
  unload = vi.fn();
  register = vi.fn();
  registerEvent = vi.fn();
}
