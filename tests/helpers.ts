import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CMapLoader } from '../src/core/pdf.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);
const CMAPS = new URL('../assets/cmaps/', import.meta.url);

export function fixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), 'utf8');
}

export function fixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(name, FIXTURES))));
}

export const cmapLoader: CMapLoader = async (filename) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(filename, CMAPS))));
