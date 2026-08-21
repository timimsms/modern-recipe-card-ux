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

createServer((request, response) => {
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
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
    createReadStream(path).pipe(response)
  } catch {
    response
      .writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      .end(`404 ${url.pathname}`)
  }
}).listen(port, () => {
  console.log(`serving ${root}`)
  console.log(`  http://localhost:${port}/experiments/01-css-grid/`)
})
