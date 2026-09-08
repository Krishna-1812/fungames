import type { APIRoute } from 'astro'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { STREET, sceneSvg, STREET_JPEG } from '../lib/robot-scene'

/**
 * The CAPTCHA's street, rasterised once at build time.
 *
 * It was served as SVG at first, and that was wrong twice over. Every tile in
 * the grid is its own view of the same drawing, so the browser ran the whole
 * filter stack nine times: five turbulence fields, a blur, a grade and grain,
 * per square. And a real challenge's tiles are not drawings, they are crops of
 * one photograph.
 *
 * JPEG rather than PNG, and not only because PNG came out at 1.2MB against
 * 85KB — the texture and grain that make the picture work are exactly what
 * lossless compression cannot do anything with. JPEG's own artefacts, the
 * ringing along every hard edge and the softening in the flat areas, are what
 * a real tile has too. It is the honest container for this image.
 *
 * 900 across gives 300 per tile, against the roughly 126 CSS pixels a tile
 * actually occupies — comfortable on a two-times display.
 */
export const GET: APIRoute = async () => {
  const png = new Resvg(sceneSvg(STREET), {
    fitTo: { mode: 'width', value: STREET_JPEG.width },
  }).render().asPng()

  const jpg = await sharp(png)
    .jpeg({ quality: STREET_JPEG.quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer()

  return new Response(new Uint8Array(jpg), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
