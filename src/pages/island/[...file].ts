import type { APIRoute, GetStaticPaths } from 'astro'
import { homeBake } from '../../lib/island/home'
import { bakedFile } from '../../lib/island/bake'

/**
 * The homepage island's baked files (lib/island/bake): the cells, sprite
 * sheets, level indexes, the scene and the poster, under the bake's own hash,
 * so each one can be cached for good (vercel.json) and a new island is a new
 * set of names.
 */
const TYPES: Record<string, string> = { webp: 'image/webp', json: 'application/json' }

export const getStaticPaths: GetStaticPaths = () => {
  const b = homeBake()
  return b.files.map((f) => ({ params: { file: `${b.hash}/${f}` } }))
}

export const GET: APIRoute = ({ params }) => {
  const b = homeBake()
  const path = params.file ?? ''
  const file = path.slice(b.hash.length + 1)
  const ext = file.split('.').pop() ?? ''
  return new Response(new Uint8Array(bakedFile(b, file)), { headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' } })
}
