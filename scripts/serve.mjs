#!/usr/bin/env node
/**
 * A static file server for the experiment tracks.
 *
 * Exists for one reason: it sends `Cache-Control: no-store`. These tracks have no build step, so
 * an edited module or stylesheet is otherwise served from the browser cache and you spend your
 * time debugging code you already fixed — which happened twice while building track 01, once for
 * a module and once for the tokens stylesheet.
 *
 *   pnpm serve            # http://localhost:8731
 *   pnpm serve 3000
 *
 * Running it twice is the normal case rather than a mistake — you leave one in a terminal, come
 * back tomorrow, and run it again. So a busy port is handled rather than thrown: if the thing
 * already listening is this same server on this same tree, that is a success, and the only useful
 * output is the URL.
 */
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, normalize } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] ?? 8731)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.map': 'application/json; charset=utf-8',
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`)
  // `normalize` collapses any `..` before the prefix check, so a request cannot escape the repo.
  let path = join(root, normalize(decodeURIComponent(url.pathname)))
  if (!path.startsWith(root)) {
    response.writeHead(403).end('forbidden')
    return
  }

  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html')
    const type = TYPES[extname(path)] ?? 'application/octet-stream'
    response.writeHead(200, {
      'content-type': type,
      'cache-control': 'no-store',
      // Which working tree this is. A second checkout of the same repo answers `/package.json`
      // identically, so a name check would report "already serving" for a server whose edits you
      // will never see. Localhost, so the path is not a disclosure.
      'x-recipe-root': root,
    })
    createReadStream(path).pipe(response)
  } catch {
    response
      .writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      .end(`404 ${url.pathname}`)
  }
})

const url = `http://localhost:${port}/experiments/01-css-grid/`

/** The working tree the server on this port is serving, if it is one of ours. */
async function servedRoot() {
  try {
    const response = await fetch(`http://localhost:${port}/package.json`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok ? (response.headers.get('x-recipe-root') ?? undefined) : undefined
  } catch {
    return undefined
  }
}

server.on('error', async (error) => {
  if (error.code !== 'EADDRINUSE') throw error
  const serving = await servedRoot()

  if (serving === root) {
    console.log(`already serving this tree on port ${port} — nothing to do`)
    console.log(`  ${url}`)
    process.exit(0)
  }

  console.error(
    serving
      ? `port ${port} is serving a different checkout:\n  ${serving}\nEdits here will not show up there.`
      : `port ${port} is taken by something that is not this server.`,
  )
  console.error(`\n  pnpm serve ${port + 1}      # or pick any free port`)
  console.error(`  lsof -nP -iTCP:${port} -sTCP:LISTEN   # to see what has it`)
  process.exit(1)
})

server.listen(port, () => {
  console.log(`serving ${root}`)
  console.log(`  ${url}`)
})
