/**
 * Penjaga utang CSS. Gagal bila ada deklarasi yang selalu tertimpa, kelas atau keyframes yang tak dipakai,
 * atau selektor yang tersebar di lebih banyak berkas daripada batas sekarang (batas hanya boleh turun).
 */
import fs from 'node:fs';
import path from 'node:path';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const stylesDir = path.join(root, 'src/styles');
const files = fs
  .readdirSync(stylesDir)
  .filter((f) => f.endsWith('.css'))
  .sort();

/** Selektor yang muncul di lebih dari satu berkas. Turunkan angka ini setiap kali menggabungkan; jangan naikkan. */
const BATAS_SELEKTOR_TERSEBAR = 117;

type Aturan = { f: string; i: number; ctx: string; sels: string[]; decls: Declaration[] };

function muatAturan(): Aturan[] {
  const out: Aturan[] = [];
  for (const f of files) {
    postcss.parse(fs.readFileSync(path.join(stylesDir, f), 'utf8')).walkRules((r: Rule) => {
      if (
        r.parent?.type === 'atrule' &&
        /keyframes|font-face/.test((r.parent as { name: string }).name)
      )
        return;
      const ctx: string[] = [];
      for (let p = r.parent; p && p.type !== 'root'; p = p.parent)
        if (p.type === 'atrule')
          ctx.unshift(
            `@${(p as { name: string; params: string }).name} ${(p as { params: string }).params}`,
          );
      out.push({
        f,
        i: out.length,
        ctx: ctx.join(' > '),
        sels: r.selectors.map((s) => s.replace(/\s+/g, ' ').trim()),
        decls: (r.nodes ?? []).filter((n): n is Declaration => n.type === 'decl'),
      });
    });
  }
  return out;
}

function bacaKode(): string {
  const walk = (d: string): string[] =>
    fs
      .readdirSync(d, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  return walk(path.join(root, 'src'))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
}

const aturan = muatAturan();
const css = files.map((f) => fs.readFileSync(path.join(stylesDir, f), 'utf8')).join('\n');

describe('Utang CSS', () => {
  it('tidak ada deklarasi yang selalu tertimpa aturan berselektor sama yang lebih akhir', () => {
    const by = new Map<string, Aturan[]>();
    for (const r of aturan)
      for (const s of r.sels) {
        const k = `${r.ctx}||${s}`;
        by.set(k, [...(by.get(k) ?? []), r]);
      }
    const mati: string[] = [];
    for (const r of aturan)
      for (const d of r.decls) {
        if (d.important) continue;
        const p = d.prop.toLowerCase();
        const tertimpa = r.sels.every((s) =>
          by
            .get(`${r.ctx}||${s}`)!
            .some((o) => o.i > r.i && o.decls.some((x) => x.prop.toLowerCase() === p)),
        );
        if (tertimpa) mati.push(`${r.f}: ${r.sels[0]} { ${d.prop} }`);
      }
    expect(mati).toEqual([]);
  });

  it('semua kelas di CSS dipakai di kode', () => {
    const kode = bacaKode();
    const kelas = new Set<string>();
    for (const r of aturan)
      for (const s of r.sels) for (const m of s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) kelas.add(m[1]);
    const tak = [...kelas].filter(
      (c) => !new RegExp(`(^|[^\\w-])${c.replace(/-/g, '\\-')}($|[^\\w-])`).test(kode),
    );
    expect(tak).toEqual([]);
  });

  it('semua keyframes dan properti kustom dipakai', () => {
    const kode = bacaKode();
    const kf = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    expect(
      kf.filter((k) => !new RegExp(`animation[^;{}]*\\b${k}\\b`).test(css) && !kode.includes(k)),
    ).toEqual([]);
    const defs = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const tak = [...defs].filter((d) => {
      const pakai = new RegExp(`var\\(\\s*${d}\\b`);
      return !pakai.test(css) && !pakai.test(kode) && !kode.includes(d);
    });
    expect(tak).toEqual([]);
  });

  it('selektor yang tersebar di banyak berkas tidak bertambah', () => {
    const peta = new Map<string, Set<string>>();
    for (const r of aturan) {
      const k = `${r.ctx}||${[...new Set(r.sels)].sort().join(' , ')}`;
      peta.set(k, (peta.get(k) ?? new Set()).add(r.f));
    }
    const tersebar = [...peta.values()].filter((s) => s.size > 1).length;
    expect(tersebar).toBeLessThanOrEqual(BATAS_SELEKTOR_TERSEBAR);
  });
});
