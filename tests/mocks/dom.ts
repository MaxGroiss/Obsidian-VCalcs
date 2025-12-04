/**
 * DOM utilities for testing parser and rendering logic
 */

/**
 * Create a mock vcalc callout element
 */
export function createMockCallout(pythonCode: string): HTMLElement {
  const callout = document.createElement('div');
  callout.className = 'callout';
  callout.setAttribute('data-callout', 'vcalc');

  // Create callout title
  const title = document.createElement('div');
  title.className = 'callout-title';
  const titleInner = document.createElement('div');
  titleInner.className = 'callout-title-inner';
  titleInner.textContent = 'VCalc';
  title.appendChild(titleInner);
  callout.appendChild(title);

  // Create callout content with code block
  const content = document.createElement('div');
  content.className = 'callout-content';

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = pythonCode;
  pre.appendChild(code);
  content.appendChild(pre);

  callout.appendChild(content);

  return callout;
}

/**
 * Create a mock callout with options header
 */
export function createMockCalloutWithOptions(
  pythonCode: string,
  options: {
    id?: string;
    vset?: string;
    hidden?: boolean;
    accent?: 'vset' | 'default';
    bg?: string;
    compact?: boolean;
  }
): HTMLElement {
  const parts: string[] = [];

  if (options.id) parts.push(`id=${options.id}`);
  if (options.vset) parts.push(`vset=${options.vset}`);
  if (options.hidden) parts.push('hidden');
  if (options.accent) parts.push(`accent=${options.accent}`);
  if (options.bg) parts.push(`bg=${options.bg}`);
  if (options.compact) parts.push('compact');

  const optionsLine = parts.length > 0 ? `# vcalc: ${parts.join(' ')}\n` : '';
  const fullCode = optionsLine + pythonCode;

  return createMockCallout(fullCode);
}

/**
 * Query a callout for its code block content
 */
export function getCodeBlockContent(callout: HTMLElement): string {
  const code = callout.querySelector('pre > code');
  return code?.textContent || '';
}

/**
 * Set the code block content
 */
export function setCodeBlockContent(callout: HTMLElement, content: string): void {
  const code = callout.querySelector('pre > code');
  if (code) {
    code.textContent = content;
  }
}

/**
 * Get callout title text
 */
export function getCalloutTitleText(callout: HTMLElement): string {
  const titleInner = callout.querySelector('.callout-title-inner');
  return titleInner?.textContent || '';
}

/**
 * Create a mock container for vcalc blocks
 */
export function createMockContainer(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'vcalc-container';
  return container;
}
