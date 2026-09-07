/*
 * Progressive-enhancement runtime. Plain ESM with no build step, so a browser
 * can load it with <script type="module"> and a bundler can import it as-is.
 *
 * Components that need JS register here, keyed by their data-govbb-module value.
 * CSS-only components register nothing.
 */
import { AddAnother } from './src/components/add-another/add-another.js';
import { Combobox } from './src/components/combobox/combobox.js';
import { FileUpload } from './src/components/file-upload/file-upload.js';
import { Header } from './src/components/header/header.js';
import { NumberInput } from './src/components/number-input/number-input.js';

/** @type {Record<string, new (el: HTMLElement) => { destroy(): void }>} */
const registry = {
  'add-another': AddAnother,
  combobox: Combobox,
  'file-upload': FileUpload,
  header: Header,
  'number-input': NumberInput,
};

/**
 * Scan `root` for [data-govbb-module] elements and enhance each one.
 * @param {ParentNode} [root]
 */
export function initAll(root = document) {
  for (const el of root.querySelectorAll('[data-govbb-module]')) {
    // Guard against double-init (e.g. initAll called on overlapping roots),
    // which would attach duplicate listeners.
    if ('govbbInit' in el.dataset) continue;
    const Module = registry[el.dataset.govbbModule];
    if (Module) {
      el.dataset.govbbInit = '';
      new Module(el);
    }
  }
}

export { AddAnother, Combobox, FileUpload, Header, NumberInput };
