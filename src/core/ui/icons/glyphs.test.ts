import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import glyphMap from './glyphMap.json';
import {GLYPH_PATHS} from './glyphPaths.web.ts';
import {FILLED_ICON_NAMES, hasFilledGlyph, ICON_NAMES} from './glyphs';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

function cmapCodepoints(file: string): Set<number> {
  const font = readFileSync(file);
  const tables = font.readUInt16BE(4);
  let cmap = -1;
  for (let index = 0; index < tables; index += 1) {
    const record = 12 + index * 16;
    if (font.toString('latin1', record, record + 4) === 'cmap') cmap = font.readUInt32BE(record + 8);
  }
  assert.notEqual(cmap, -1, `${file} has a cmap`);
  const codepoints = new Set<number>();
  const subtables = font.readUInt16BE(cmap + 2);
  for (let index = 0; index < subtables; index += 1) {
    const offset = cmap + font.readUInt32BE(cmap + 4 + index * 8 + 4);
    const format = font.readUInt16BE(offset);
    if (format === 12) {
      const groups = font.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group += 1) {
        const base = offset + 16 + group * 12;
        for (let code = font.readUInt32BE(base); code <= font.readUInt32BE(base + 4); code += 1) codepoints.add(code);
      }
    }
    if (format === 4) {
      const segments = font.readUInt16BE(offset + 6) / 2;
      for (let segment = 0; segment < segments; segment += 1) {
        const end = font.readUInt16BE(offset + 14 + segment * 2);
        const start = font.readUInt16BE(offset + 16 + segments * 2 + segment * 2);
        for (let code = start; code <= end && code !== 0xffff; code += 1) codepoints.add(code);
      }
    }
  }
  return codepoints;
}

test('the glyph list is the 54 Material Symbols names of B2.9 with seven filled variants', () => {
  assert.equal(ICON_NAMES.length, 54);
  assert.equal(new Set(ICON_NAMES).size, 54);
  assert.deepEqual([...FILLED_ICON_NAMES], ['home', 'search', 'video_library', 'account_circle', 'bookmark', 'check_circle', 'star']);
  assert.equal(hasFilledGlyph('star'), true);
  assert.equal(hasFilledGlyph('star_half'), false);
});

test('the generated glyph map, web paths and SVG lock cover exactly the glyph list', () => {
  assert.deepEqual(Object.keys(glyphMap), [...ICON_NAMES]);
  assert.deepEqual(Object.keys(GLYPH_PATHS), [...ICON_NAMES]);
  for (const name of ICON_NAMES) {
    const paths = GLYPH_PATHS[name];
    assert.match(paths.outline, /^[Mm][-0-9.,\sA-Za-z]+[Zz]$/, name);
    assert.equal(paths.filled !== undefined, hasFilledGlyph(name), name);
  }
  const lock = JSON.parse(readFileSync(join(ROOT, 'scripts/icons/svg-sources.json'), 'utf8'));
  assert.equal(lock.commit, '10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7');
  assert.equal(Object.keys(lock.files).length, ICON_NAMES.length + FILLED_ICON_NAMES.length);
  for (const sha of Object.values(lock.files)) assert.match(String(sha), /^[0-9a-f]{40}$/);
});

test('the Android icon fonts map every glyph, and the filled font maps the filled set', () => {
  const outline = cmapCodepoints(join(ROOT, 'src/core/ui/icons/YifyIcons.ttf'));
  const filled = cmapCodepoints(join(ROOT, 'src/core/ui/icons/YifyIconsFilled.ttf'));
  const codepoints = glyphMap as Record<string, number>;
  assert.deepEqual([...outline].sort(), ICON_NAMES.map((name) => codepoints[name]).sort());
  assert.deepEqual([...filled].sort(), FILLED_ICON_NAMES.map((name) => codepoints[name]).sort());
});
