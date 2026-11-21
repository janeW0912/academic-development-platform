import { createReadStream, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openCatalog } from './catalog.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = join(root, 'dist')
const files = new Map<string, string>()
for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue
  const filename = join(entry.parentPath, entry.name)
  files.set('/' + relative(dist, filename).split(sep).map(encodeURIComponent).join('/'), filename)
}

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
])

const catalog = openCatalog(root)
const server = createServer((req, res) => {
  catalog.middleware(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const url = URL.parse(req.url ?? '/', 'http://localhost')
    if (!url) {
      res.writeHead(400).end()
      return
    }
    const { pathname } = url
    const filename = files.get(pathname === '/' ? '/index.html' : pathname)
    if (!filename) {
      res.writeHead(404).end()
      return
    }
    const stat = statSync(filename, { throwIfNoEntry: false })
    if (!stat?.isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': contentTypes.get(extname(filename)) ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    })
    if (req.method === 'HEAD') res.end()
    else createReadStream(filename).on('error', () => res.destroy()).pipe(res)
  })
})
server.once('close', catalog.close)
const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? '3000')
server.listen(port, host, () => console.log(`Course progress is running at http://${host}:${port}/`))
