import { spawn } from 'node:child_process'
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import { openCatalog } from './course/server/catalog.ts'

const root = import.meta.dirname
const catalog = openCatalog(join(root, 'course'))
const pages = {
  '/course/': 'course/dist',
  '/research-competition/': 'research-competition',
  '/activity-analysis/': 'activity-analysis/dist',
  '/project-review/': 'project-review/dist',
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

const server = createServer((req, res) => {
  catalog.middleware(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    let path
    try {
      path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    } catch {
      res.writeHead(400).end()
      return
    }
    const canonical = path + '/'
    if (Object.hasOwn(pages, canonical)) {
      res.writeHead(308, { Location: canonical }).end()
      return
    }
    const prefix = Object.keys(pages).find((route) => path.startsWith(route)) ?? '/'
    const directory = join(root, pages[prefix] ?? 'home-page/dist')
    const filename = resolve(directory, path.slice(prefix.length) || 'index.html')
    if (!filename.startsWith(directory + sep) || !statSync(filename, { throwIfNoEntry: false })?.isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'Content-Type': types[extname(filename)] ?? 'application/octet-stream' })
    if (req.method === 'HEAD') res.end()
    else createReadStream(filename).on('error', () => res.destroy()).pipe(res)
  })
})
server.once('close', catalog.close)
const port = Number(process.env.PLATFORM_PORT ?? '4170')
server.listen(port, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/'
  console.log(url)
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { stdio: 'ignore' })
    browser.on('error', () => console.log('Open this address in your browser: ' + url))
  }
})
