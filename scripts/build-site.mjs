#!/usr/bin/env node
/**
 * Assembles the GitHub Pages site into `_site/`.
 *
 * The site is the repo's own directory structure, minimally copied, so every relative path that
 * works on `pnpm serve` works under the Pages project subpath unchanged. Nothing is rewritten at
 * publish time — if a path needs rewriting to deploy, it was wrong (root-relative) and should be
 * fixed at the source, which is how the corpus fetches and vite bases are already written.
 *
 *   node scripts/build-site.mjs        # assumes `pnpm build && pnpm build:tracks` have run
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { marked } from 'marked'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const site = join(root, '_site')

rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })

// --- The working structure, copied ------------------------------------------------------------

const copies = [
  // What the tracks load at runtime.
  'packages/core/dist',
  'packages/tokens/tokens.css',
  'packages/corpus/recipes',
  'packages/corpus/fixtures',
  // Buildless tracks, served from source.
  'experiments/01-css-grid/index.html',
  'experiments/01-css-grid/src',
  'experiments/03-svg/index.html',
  'experiments/03-svg/src',
  // Built tracks.
  'experiments/02-react-shadcn/dist',
  'experiments/04-alt-frameworks/dist',
  // Design studies are already self-contained HTML.
  'docs/design',
]

for (const rel of copies) {
  cpSync(join(root, rel), join(site, rel), { recursive: true })
}
// Tests and snapshots are repo furniture, not site content.
for (const junk of ['experiments/01-css-grid/src/main.js.map'])
  rmSync(join(site, junk), { force: true })

// --- Findings and notes, rendered -------------------------------------------------------------

const PAGE_CSS = `
:root{--paper:#fbfaf5;--surface:#fff;--ink:#16211b;--soft:#4a5a51;--rule:#2f6b45;--hair:#e2e7e2;--clay:#854c0e}
@media (prefers-color-scheme: dark){:root{--paper:#10150f;--surface:#181f19;--ink:#e8efe7;--soft:#a3b3a7;--rule:#6cba86;--hair:#29332a;--clay:#f0c274}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);
font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
main{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}
h1,h2,h3{font-family:"Iowan Old Style",Palatino,Georgia,serif;line-height:1.2}
a{color:var(--rule)}code{font-family:ui-monospace,Menlo,monospace;font-size:.9em;
background:var(--surface);border:1px solid var(--hair);border-radius:3px;padding:.05em .3em}
pre{background:var(--surface);border:1px solid var(--hair);border-radius:5px;padding:.9rem;overflow-x:auto}
pre code{border:0;padding:0;background:none}
table{border-collapse:collapse;width:100%;font-size:.92em}
th,td{border:1px solid var(--hair);padding:.35rem .6rem;text-align:left;vertical-align:top}
blockquote{margin:0;padding:.2rem 1rem;border-left:3px solid var(--rule);color:var(--soft)}
.crumb{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;margin-bottom:1.5rem}
`

function page(title, crumbHref, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${PAGE_CSS}</style></head><body><main>
<p class="crumb"><a href="${crumbHref}">← modern-recipe-card-ux</a></p>
${body}</main></body></html>`
}

function renderMarkdownDir(fromDir, toDir, crumbHref) {
  mkdirSync(join(site, toDir), { recursive: true })
  const entries = []
  for (const file of readdirSync(join(root, fromDir))
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    const md = readFileSync(join(root, fromDir, file), 'utf8')
    // Sibling .md links become .html; everything else is left alone.
    const html = marked.parse(
      md.replace(/\((\.\.?\/)?([\w-]+)\.md\)/g, (m, pre, name) => `(${pre ?? ''}${name}.html)`),
    )
    const out = file.replace(/\.md$/, '.html')
    const title = md.match(/^#\s+(.+)$/m)?.[1] ?? file
    writeFileSync(join(site, toDir, out), page(title, crumbHref, html))
    entries.push({ file: out, title })
  }
  return entries
}

const findings = renderMarkdownDir('docs/findings', 'docs/findings', '../../')
// Track 01 has no NOTES.md and is not given one retrospectively — PHASE-07's rule that
// retrospective notes are fiction applies to the reference track most of all. Its story is the
// findings themselves.
for (const track of ['02-react-shadcn', '03-svg', '04-alt-frameworks']) {
  const md = readFileSync(join(root, `experiments/${track}/NOTES.md`), 'utf8')
  writeFileSync(
    join(site, `experiments/${track}/NOTES.html`),
    page(`${track} — build notes`, '../../', marked.parse(md)),
  )
}

// --- The landing page --------------------------------------------------------------------------
// Three beats, in order: the chart itself, then what it costs, then cook mode.

const findingsList = findings
  .map((f) => `<li><a href="docs/findings/${f.file}">${f.title.replace(/^#\s*/, '')}</a></li>`)
  .join('\n')

writeFileSync(
  join(site, 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Modern Recipe Card UX</title><style>${PAGE_CSS}
main{max-width:64rem}
.hero{border:1px solid var(--hair);border-radius:6px;overflow:hidden;background:var(--surface)}
.hero iframe{width:100%;height:640px;border:0;display:block}
.tracks{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.8rem;padding:0;list-style:none}
.tracks li{border:1px solid var(--hair);border-radius:6px;background:var(--surface);padding:.9rem 1rem}
.tracks b{display:block;margin-bottom:.25rem}
.kb{font-family:ui-monospace,Menlo,monospace;color:var(--clay)}
</style></head><body><main>
<h1>A recipe is not a list — it's a tree</h1>
<p>Ingredients are leaves, steps consume leaves and other steps, the finished dish is the root.
The <a href="https://www.cookingforengineers.com/">Cooking&nbsp;For&nbsp;Engineers</a> grid drew
that tree in 2004 as an HTML table. This project rebuilds the idea as a rigorous shared core —
model, validator, layout engine, kitchen state — then renders it four independent ways and
measures what each approach costs.</p>

<div class="hero">
<iframe src="experiments/01-css-grid/?recipe=shepherds-pie" title="Shepherd's pie as a convergence chart" loading="lazy"></iframe>
</div>
<p><b>The chart above is zero JavaScript.</b> The static, correct chart is HTML and CSS Grid;
the script only adds interaction. Here is the same plan, four ways:</p>

<ul class="tracks">
<li><b>CSS Grid</b> no framework, no bundler — <span class="kb">0 KB JS</span> static
<br><a href="experiments/01-css-grid/">open</a> · the reference — its notes are the findings below</li>
<li><b>SVG dendrogram</b> real drawn edges; owns the non-planar reuse case — <span class="kb">0 KB JS</span> static
<br><a href="experiments/03-svg/?recipe=fixtures/valid/reuse-split">open on the case it owns</a> · <a href="experiments/03-svg/NOTES.html">notes</a></li>
<li><b>Solid + Svelte</b> one design, two reactivity models — <span class="kb">16 / 25 KB gz</span>
<br><a href="experiments/04-alt-frameworks/dist/solid.html">solid</a> · <a href="experiments/04-alt-frameworks/dist/svelte.html">svelte</a> · <a href="experiments/04-alt-frameworks/NOTES.html">notes</a></li>
<li><b>React + Tailwind + Radix</b> the mainstream stack — <span class="kb">77 KB gz</span>
<br><a href="experiments/02-react-shadcn/dist/">open</a> · <a href="experiments/02-react-shadcn/NOTES.html">notes</a></li>
</ul>

<p>Try <a href="experiments/01-css-grid/?recipe=bbq-pulled-chicken&view=cook">cook mode</a> —
one step at a time for a phone propped against a canister, with the tree kept visible, progress
weighted by <em>time</em> rather than step count, and timers that survive a locked phone. Or
<a href="experiments/01-css-grid/?recipe=shepherds-pie&view=narrative">the same tree said out
loud</a>.</p>

<h2>The findings</h2>
<p>The build overturned several of its own assumptions — including the format's headline claim.
Written up as they happened:</p>
<ul>
${findingsList}
</ul>

<h2>Design studies</h2>
<p>Self-contained HTML, no build: <a href="docs/design/resolved-card.html">the resolved card</a>,
<a href="docs/design/q5-time-axis-variants.html">six time-axis treatments</a>,
<a href="docs/design/q1-column-assignment.html">three column strategies</a>,
<a href="docs/design/i4-ingredient-reuse.html">five reuse strategies</a>.</p>

<p>Source, corpus format and contribution guide:
<a href="https://github.com/timimsms/modern-recipe-card-ux">github.com/timimsms/modern-recipe-card-ux</a></p>
</main></body></html>`,
)

console.log(`built ${site}`)
