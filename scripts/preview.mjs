/**
 * preview — serve the built site from dist/client, the way Vercel serves its
 * static files (`npm run preview`, on :4400, or --port N).
 *
 * The Vercel adapter has no `astro preview` of its own, and the built pages
 * are all static, so this is enough to QA a build. The analytics API is not
 * here: its calls get a 404 and the tracker shrugs. Try the API with
 * `npm run dev`, which runs it against a local database (PGlite).
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'

const root = join(process.cwd(), 'dist', 'client')
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4400
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2' }

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  // trailingSlash: 'always', as on Vercel.
  if (!extname(path) && !path.endsWith('/')) { res.writeHead(308, { location: path + '/' }); return res.end() }
  let f = normalize(join(root, path))
  if (!f.startsWith(root)) { res.writeHead(403); return res.end() }
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html') } catch {}
  try {
    const body = await readFile(f)
    res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
    res.end(await readFile(join(root, '404.html')).catch(() => 'not found'))
  }
}).listen(port, () => console.log(`preview: dist/client on http://localhost:${port}/`))
