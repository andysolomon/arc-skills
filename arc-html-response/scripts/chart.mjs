#!/usr/bin/env node
// Turn numbers into ready-to-paste kit markup, so pages never compute chart
// coordinates by hand. Plain Node, no dependencies. Output uses the classes in
// components.html, so copy the matching CSS block from there too.
//
//   node chart.mjs bars   --labels esbuild,Vite,webpack --values 1.2,2.9,9.8 --unit " s" [--sort asc|desc] [--key Vite]
//   node chart.mjs line   --slug latency --title "p95 latency by week" --desc "..." \
//                         --labels W1,W2,W3 --values 420,390,410 --unit " ms" [--min 0] [--max 500]
//   node chart.mjs donut  --slug coverage --title "Line coverage" --part 18 --whole 25 --noun files
//
// --labels and --values are comma separated (a label with a comma: use --sep ";").
// --unit is appended to each value. Use a symbol (" s", " ms", "%"), or " run| runs" for
// a noun: the part before | is used when the value is exactly 1.
// --title names the chart (bars: prefixes the aria-label). --cols "bundler,build time" names
// the raw-numbers table columns.
// Prints the markup to stdout. Paste it into the page AND copy the matching CSS block from
// components.html. Exits 2 on bad input, with the reason on stderr.

const argv = process.argv.slice(2);
const kind = argv.shift();
if (!kind || kind === '--help' || kind === '-h') {
  const src = (await import('node:fs')).readFileSync(new URL(import.meta.url), 'utf8');
  const head = src.split('\n').slice(1).filter(l => l.startsWith('//')).map(l => l.replace(/^\/\/ ?/, ''));
  process.stdout.write(head.join('\n') + '\n');
  process.exit(kind ? 0 : 2);
}

function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) die(`--${name} needs a value`);
  return v;
}
function die(msg) {
  process.stderr.write(`chart.mjs: ${msg}\n`);
  process.exit(2);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sep = opt('sep', ',');
const list = name => {
  const raw = opt(name);
  if (raw === undefined) die(`--${name} is required`);
  return raw.split(sep).map(s => s.trim());
};
const nums = name => list(name).map(s => {
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) die(`--${name} has a value that is not a number: "${s}"`);
  return n;
});
// Up to 2 decimals, trailing zeros trimmed, thousands grouped: 1234.5 -> 1,234.5
const fmt = n => {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
};
// Axis ticks stay short so they fit left of the plot: 20,000 -> 20k, 1,500,000 -> 1.5M.
const fmtAxis = n => {
  const a = Math.abs(n);
  if (a >= 1e6) return fmt(n / 1e6) + 'M';
  if (a >= 1e4) return fmt(n / 1e3) + 'k';
  return fmt(n);
};
const r1 = n => Math.round(n * 10) / 10;
// Unit for one value: " run| runs" -> " run" for 1, " runs" otherwise.
const unitFor = (unit, n) => {
  if (!unit.includes('|')) return unit;
  const [one, many] = unit.split('|');
  return n === 1 ? one : many;
};
const cols = (fallback) => {
  const c = opt('cols');
  if (c === undefined) return fallback;
  const parts = c.split(',').map(s => s.trim());
  if (parts.length !== 2 || parts.some(p => !p)) die('--cols takes two names, like "bundler,build time"');
  return parts;
};
const slugOk = s => /^[a-z][a-z0-9-]{0,40}$/.test(s);

// "Nice" axis: 3 to 6 round ticks covering [lo, hi].
function niceTicks(lo, hi) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= 5) || 10 * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let t = start; t <= end + step / 1e6; t += step) ticks.push(Math.round(t / step) * step);
  return ticks;
}

function bars() {
  const labels = list('labels');
  const values = nums('values');
  if (labels.length !== values.length) die(`${labels.length} labels but ${values.length} values`);
  if (values.some(v => v < 0)) die('bars cannot show negative values; use a table or diagram-design (waterfall)');
  const unit = opt('unit', '');
  const key = opt('key');
  const sort = opt('sort', 'desc');
  let rows = labels.map((label, i) => ({ label, value: values[i] }));
  if (sort === 'asc') rows.sort((a, b) => a.value - b.value);
  else if (sort === 'desc') rows.sort((a, b) => b.value - a.value);
  else if (sort !== 'none') die('--sort is asc, desc or none');
  const max = Math.max(...rows.map(r => r.value)) || 1;
  const u = r => unitFor(unit, r.value);
  const title = opt('title');
  const [c1, c2] = cols(['item', 'value']);
  const aria = (title ? `${title}: ` : '') + rows.map(r => `${r.label} ${fmt(r.value)}${u(r)}`).join(', ');
  const out = [`<div class="bars" role="img" aria-label="${esc(aria)}">`];
  rows.forEach((r, i) => {
    const v = r1((r.value / max) * 100);
    const cls = ['bar', r.label === key && 'is-key', r.value === 0 && 'is-zero'].filter(Boolean).join(' ');
    out.push(`  <div class="${cls}" style="--v:${v};--i:${i}"><div class="lbl">${esc(r.label)}</div><div class="track"><div class="fill"></div><span class="val">${esc(fmt(r.value) + u(r))}</span></div></div>`);
  });
  out.push('</div>');
  out.push('<details>');
  out.push('  <summary>Raw numbers</summary>');
  out.push(`  <table><tr><th>${esc(c1)}</th><th>${esc(c2)}</th></tr>${rows.map(r => `<tr><td>${esc(r.label)}</td><td>${esc(fmt(r.value) + u(r))}</td></tr>`).join('')}</table>`);
  out.push('</details>');
  return out.join('\n');
}

function line() {
  const slug = opt('slug');
  if (!slug || !slugOk(slug)) die('--slug is required: lowercase letters, digits and hyphens, starting with a letter');
  const title = opt('title');
  if (!title) die('--title is required');
  const labels = list('labels');
  const values = nums('values');
  if (labels.length !== values.length) die(`${labels.length} labels but ${values.length} values`);
  if (values.length < 2) die('a line needs at least 2 points');
  const unit = opt('unit', '');
  const minO = opt('min'), maxO = opt('max');
  const dataLo = Math.min(...values), dataHi = Math.max(...values);
  const ticks = niceTicks(minO !== undefined ? Number(minO) : dataLo, maxO !== undefined ? Number(maxO) : dataHi);
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  if (dataLo < lo || dataHi > hi) die('--min/--max cut off some values');
  // Geometry matches the kit's line component: viewBox 480 x 200, plot x 56..460, y 20..170.
  // The left margin fits a 5-character tick ("1,284") at the 16px phone axis size.
  const X0 = 56, X1 = 460, Y0 = 20, Y1 = 170;
  const x = i => r1(X0 + (i * (X1 - X0)) / (values.length - 1));
  const y = v => r1(Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0));
  const last = values.length - 1;
  const first = values[0], end = values[last];
  const U = n => fmt(n) + unitFor(unit, n);
  const [c1, c2] = cols(['point', 'value']);
  const desc = opt('desc') || `${labels[0]} ${U(first)} to ${labels[last]} ${U(end)}; low ${U(dataLo)}, high ${U(dataHi)}.`;
  const out = [`<svg class="line-chart" viewBox="0 0 480 200" role="img" aria-labelledby="${slug}-title ${slug}-desc">`];
  out.push(`  <title id="${slug}-title">${esc(title)}</title>`);
  out.push(`  <desc id="${slug}-desc">${esc(desc)}</desc>`);
  for (const t of ticks) {
    const ty = y(t);
    out.push(`  <line class="grid" x1="${X0}" y1="${ty}" x2="${X1}" y2="${ty}"/><text class="axis" x="${X0 - 6}" y="${r1(ty + 4)}" text-anchor="end">${esc(fmtAxis(t))}</text>`);
  }
  // x labels: first, middle (when 5+ points), last, so they never collide.
  const xi = values.length >= 5 ? [0, Math.round(last / 2), last] : [...values.keys()];
  for (const i of xi) out.push(`  <text class="axis" x="${x(i)}" y="192" text-anchor="middle">${esc(labels[i])}</text>`);
  out.push(`  <polyline class="series" pathLength="1" points="${values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`);
  const ey = y(end);
  out.push(`  <circle class="dot" cx="${x(last)}" cy="${ey}" r="4"/>`);
  // Put the end label above the point, or below it when the point is near the top.
  const ly = ey - 10 < Y0 + 4 ? r1(ey + 18) : r1(ey - 10);
  out.push(`  <text class="end" x="${X1 - 8}" y="${ly}" text-anchor="end">${esc(U(end))}</text>`);
  out.push('</svg>');
  out.push('<details>');
  out.push('  <summary>Raw numbers</summary>');
  out.push(`  <table><tr><th>${esc(c1)}</th><th>${esc(c2)}</th></tr>${labels.map((l, i) => `<tr><td>${esc(l)}</td><td>${esc(U(values[i]))}</td></tr>`).join('')}</table>`);
  out.push('</details>');
  return out.join('\n');
}

function donut() {
  const slug = opt('slug');
  if (!slug || !slugOk(slug)) die('--slug is required: lowercase letters, digits and hyphens, starting with a letter');
  const title = opt('title');
  if (!title) die('--title is required');
  const part = Number(opt('part')), whole = Number(opt('whole'));
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0 || part < 0 || part > whole) die('--part and --whole must be numbers with 0 <= part <= whole and whole > 0');
  const noun = opt('noun', '');
  const pct = (part / whole) * 100;
  const share = r1(pct);
  const big = `${pct < 10 && !Number.isInteger(r1(pct)) ? r1(pct) : Math.round(pct)}%`;
  const small = `${fmt(part)} / ${fmt(whole)}${noun ? ' ' + noun : ''}`;
  const desc = opt('desc') || `${big}: ${fmt(part)} of ${fmt(whole)}${noun ? ' ' + noun : ''}.`;
  return [
    `<svg class="donut" viewBox="0 0 42 42" role="img" aria-labelledby="${slug}-title ${slug}-desc">`,
    `  <title id="${slug}-title">${esc(title)}</title>`,
    `  <desc id="${slug}-desc">${esc(desc)}</desc>`,
    '  <circle class="ring" cx="21" cy="21" r="15.915"/>',
    `  <circle class="part" cx="21" cy="21" r="15.915" stroke-dasharray="${share} ${r1(100 - share)}"/>`,
    `  <text class="big" x="21" y="22.5" text-anchor="middle">${esc(big)}</text>`,
    `  <text class="small" x="21" y="27.5" text-anchor="middle">${esc(small)}</text>`,
    '</svg>',
  ].join('\n');
}

const kinds = { bars, line, donut };
if (!kinds[kind]) die(`first argument is the chart kind: ${Object.keys(kinds).join(', ')}`);
process.stdout.write(kinds[kind]() + '\n');
