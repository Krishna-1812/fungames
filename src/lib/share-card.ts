/**
 * Turning a result card into something a person can actually send.
 *
 * The site is static, so there is no server to render a result on request and
 * no URL that could point at one. Everything here therefore happens in the
 * browser: `result-card.ts` builds the SVG, this rasterises it to a PNG and
 * hands it to whatever the platform offers.
 *
 * Three routes, in the order they are worth having:
 *
 *   1. `navigator.share` **with the file**. On a phone this is the whole point
 *      — the picture goes into the message rather than a link that unfurls
 *      into the game's generic card. It is gated on `canShare({ files })`,
 *      because several browsers implement `share` without file support and
 *      throw only once you call it.
 *   2. A download. On a desktop there is usually no share sheet, and a PNG in
 *      the downloads folder is a thing you can drag into anything.
 *   3. The URL on the clipboard, which is what the chrome button did before
 *      any of this existed and is still the right last resort.
 *
 * Rasterising is `<img src="data:image/svg+xml,…">` onto a canvas. That works
 * only because every drawing on this site is self-contained: no external
 * images, no webfonts, no `<foreignObject>`. An SVG that referenced anything
 * off-document would either fail to load or taint the canvas, and `toBlob`
 * would throw a SecurityError rather than return a picture.
 */

import { resultCardSvg, CARD, type ResultCard } from './result-card'

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'dismissed' | 'failed'

/** The SVG as a data URL. Encoded, because a hex colour is full of `#`. */
const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** Rasterise a card at 1200×630. Rejects rather than returning half a picture. */
export async function cardBlob(card: ResultCard): Promise<Blob> {
  const svg = resultCardSvg(card)
  const img = new Image()
  img.decoding = 'sync'
  img.src = dataUrl(svg)
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('share-card: the browser would not load the svg'))
  })
  const canvas = document.createElement('canvas')
  canvas.width = CARD.W
  canvas.height = CARD.H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('share-card: no 2d context')
  ctx.drawImage(img, 0, 0, CARD.W, CARD.H)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('share-card: toBlob gave nothing'))), 'image/png')
  })
}

/** Put the card in the page, as SVG, so it is crisp at any size. */
export function previewCard(host: HTMLElement, card: ResultCard) {
  host.innerHTML = resultCardSvg(card)
  const svg = host.querySelector('svg')
  if (svg) {
    // The SVG carries its own width and height for the rasteriser; in the page
    // it should fill whatever box it is given.
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    svg.setAttribute('style', 'width:100%;height:auto;display:block')
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately cancels the download in some browsers; one frame is
  // enough for the click to have been taken up.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Share a result: the picture if the platform will take it, the file if not,
 * the link if neither.
 *
 * Returns what actually happened rather than a boolean, because the caller
 * wants to say "Saved" or "Copied" and those are different sentences.
 */
export async function shareResult(
  card: ResultCard,
  meta: { title: string; text: string; url: string },
): Promise<ShareOutcome> {
  let blob: Blob | null = null
  try {
    blob = await cardBlob(card)
  } catch {
    // Canvas or SVG rasterising is unavailable or refused. The link still is.
  }

  if (blob) {
    const file = new File([blob], `${card.slug}.png`, { type: 'image/png' })
    // `canShare` is the gate: several browsers expose `share` and reject files.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: meta.title, text: meta.text })
        return 'shared'
      } catch (e) {
        // A cancelled share sheet is not a failure and must not fall through
        // to a download — the person just said no.
        if (e instanceof DOMException && e.name === 'AbortError') return 'dismissed'
      }
    }
    try {
      download(blob, `${card.slug}.png`)
      return 'downloaded'
    } catch {
      /* fall through to the link */
    }
  }

  try {
    await navigator.clipboard.writeText(meta.url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** What to put on the button afterwards. */
export const outcomeLabel: Record<ShareOutcome, string> = {
  shared: 'Shared',
  downloaded: 'Saved',
  copied: 'Link copied',
  dismissed: 'Share',
  failed: 'Share',
}
