#!/usr/bin/env node
// Build a page that renders the kit's components with realistic worst-case data:
// long unbreakable words, long paths and URLs, zero, exactly one, huge counts,
// right-to-left text, many rows. Demo data is chosen to make a design look good;
// this undoes that choice. Method after break-ui (emilkowalski/skills, MIT).
//
//   node tests/worst-case.mjs <out.html>
//
// It builds its <style> from template.html plus the kit's component blocks, so it tests
// the kit as it is now. Preview the result at 390 (light) and 728 (dark): nothing may push the
// page sideways, overlap, or get cut off. See tests/fresh-agent.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.dirname(here);
const out = process.argv[2];
if (!out) { process.stderr.write('usage: node tests/worst-case.mjs <out.html>\n'); process.exit(2); }

// A real page is the template's base plus the kit's component blocks; test exactly that.
const tpl = fs.readFileSync(path.join(skill, 'template.html'), 'utf8');
const kit = fs.readFileSync(path.join(skill, 'components.html'), 'utf8');
const tplCss = tpl.slice(tpl.indexOf('<style>') + 7, tpl.indexOf('</style>'));
const kitCss = kit.slice(kit.indexOf('/* component: '), kit.indexOf('</style>'));
const style = `<style>\n${tplCss}\n${kitCss}</style>`;
const chart = (...args) => execFileSync(process.execPath, [path.join(skill, 'scripts', 'chart.mjs'), ...args], { encoding: 'utf8' });

const LONG_PATH = 'packages/notifications/src/preferences/Benachrichtigungseinstellungen/useNotificationPreferencesSubscription.test.ts';
const LONG_URL = 'https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved';
const EMAIL = 'bartholomew.fitzgerald@northwind-industries-holdings.example.com';

const body = `
  <div class="kicker">worst case · every kit component · not a real page</div>
  <h1>Benachrichtigungseinstellungen für Aleksandra Wiśniewska-Kowalczyk: 1,284,000 Ereignisse.</h1>
  <p class="lede">A headline and lede with an unbreakable German compound, a long hyphenated name, and a seven-digit count. ${EMAIL} sits in running text.</p>

  <section>
    <h2>stats: huge, zero, exactly one</h2>
    <div class="stats">
      <div class="stat"><b>1,284,000<small> / 1,284,001</small></b><span>events delivered to subscribers in the last thirty days across every region</span></div>
      <div class="stat"><b>0<small> / 40</small></b><span>runs</span></div>
      <div class="stat"><b>1<small> run</small></b><span>NOT_RUN on CI</span></div>
    </div>
  </section>

  <section>
    <h2>bars: long labels, a zero, a giant</h2>
${chart('bars', '--title', 'Events by region', '--labels', 'Paramètres de confidentialité et de sécurité;Benachrichtigungseinstellungen;Jo;نور الهدى عبد الرحمن;zero', '--sep', ';', '--values', '1284000;56;1;12;0', '--unit', ' event| events', '--cols', 'region,events')}
  </section>

  <section>
    <h2>line: one point far above the rest</h2>
${chart('line', '--slug', 'wc-line', '--title', 'Queue depth', '--labels', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', '--values', '3,2,4,1284000,5,0,1', '--unit', ' job| jobs')}
  </section>

  <section>
    <h2>donut: nothing yet</h2>
    <div class="donut-row">
${chart('donut', '--slug', 'wc-donut', '--title', 'Coverage', '--part', '0', '--whole', '1284', '--noun', 'files')}
      <p class="sub" style="margin:0">Zero of 1,284 files.</p>
    </div>
  </section>

  <section>
    <h2>changes: a path with no break points</h2>
    <div class="wide">
      <table class="changes stack-sm">
        <tr><th>file</th><th>+/−</th><th>what</th></tr>
        <tr><td class="f">${LONG_PATH}<span class="kind">new</span></td><td class="n">+12,840 −9,999</td><td>A generated fixture with every locale's notification strings, including the German compound above.</td></tr>
        <tr><td class="f">a.ts</td><td class="n">+0 −0</td><td>Renamed only.</td></tr>
        <tr><td class="f">IMG_20250914_183022_HDR_portrait_edited_edited.HEIC</td><td class="n">+1</td><td>Binary.</td></tr>
      </table>
    </div>
  </section>

  <section>
    <h2>findings: long location, right-to-left name</h2>
    <ul class="findings">
      <li><span class="st fail">FAIL</span><div><b>Unsubscribe link for ${EMAIL} 404s</b><p>The link drops the query string.</p><span class="at">${LONG_URL}</span></div></li>
      <li><span class="st warn">WARN</span><div><b>نور الهدى عبد الرحمن renders left-to-right in the digest</b><p>Set dir="auto" on user-supplied names.</p><span class="at">${LONG_PATH}:1284</span></div></li>
      <li><span class="st nr">NOT_RUN</span><div><b>J</b><p>One-letter title.</p></div></li>
    </ul>
  </section>

  <section>
    <h2>compare: one cell much longer than the rest</h2>
    <div class="wide">
      <table class="compare stack-sm">
        <tr><th>option</th><th>setup</th><th>cost</th><th>fits because</th></tr>
        <tr><td class="pick">Benachrichtigungseinstellungen-Dienst</td><td>one</td><td>$12,345,678.90</td><td>${LONG_URL}</td></tr>
        <tr><td>Jo</td><td>—</td><td>$0</td><td>Short.</td></tr>
      </table>
    </div>
  </section>

  <section>
    <h2>decisions: long options</h2>
    <div class="decisions">
      <details open>
        <summary>1. Should the Benachrichtigungseinstellungen migration run for all 1,284,000 subscribers at once, or region by region?</summary>
        <ul>
          <li class="pick"><span class="k">A</span><div><b>Region by region, starting with the smallest (Jo's test workspace)</b><span class="rec">RECOMMENDED</span><p>${EMAIL} gets the first report.</p></div></li>
          <li><span class="k">B</span><div><b>All at once</b><p>Faster.</p></div></li>
        </ul>
      </details>
    </div>
  </section>

  <section>
    <h2>timeline and packet: long lines</h2>
    <ol class="timeline">
      <li class="is-key"><time>2026-11-23 09:12</time>Deploy ${LONG_PATH} rolls out to every region at once.</li>
      <li><time>2026-11-23 09:20</time>1 error.</li>
    </ol>
    <div class="packet">
<span class="key">revision</span> unknown<br>
<span class="key">changed</span> 3 files, +12,841 −9,999<br>
<span class="key">evidence</span> ${LONG_PATH} → 1,284 passed<br>
<span class="key">checks</span> <span class="pass">PASS</span> unit · <span class="nr">NOT_RUN</span> e2e<br>
<span class="key">open</span> ${LONG_URL}
    </div>
  </section>`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kit Worst Case</title>
<meta name="color-scheme" content="dark light">
${style}
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
fs.writeFileSync(out, page);
process.stdout.write(`wrote ${out}\n`);
