/**
 * Reading and writing the island's SVG markup, at build time. The markup is
 * the island's own (kit.ts renders it), so this reads exactly that: elements,
 * attributes in double quotes, text, and the four entities kit.ts writes.
 */

export type El = { tag: string; attrs: Record<string, string>; kids: (El | string)[]; parent?: El }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unesc = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e]))
const escA = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escT = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Parse markup into a list of top-level nodes (elements and text). */
export function parse(src: string): (El | string)[] {
  const root: El = { tag: '#root', attrs: {}, kids: [] }
  const stack: El[] = [root]
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)/g
  let m: RegExpExecArray | null
  let at = 0
  while ((m = re.exec(src))) {
    if (m.index !== at) throw new Error(`xml: cannot read markup at ${at}: ${src.slice(at, at + 60)}`)
    at = re.lastIndex
    const top = stack[stack.length - 1]
    if (m[5] !== undefined) { if (m[5].trim() || top.tag === 'text' || top.tag === 'tspan') top.kids.push(unesc(m[5])); continue }
    const [, close, tag, rawAttrs, self] = m
    if (close) {
      if (top.tag !== tag) throw new Error(`xml: </${tag}> closes <${top.tag}>`)
      stack.pop(); continue
    }
    const attrs: Record<string, string> = {}
    for (const a of rawAttrs.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1]] = unesc(a[2])
    const el: El = { tag, attrs, kids: [], parent: top === root ? undefined : top }
    top.kids.push(el)
    if (!self) stack.push(el)
  }
  if (at !== src.length) throw new Error(`xml: trailing markup at ${at}`)
  if (stack.length !== 1) throw new Error(`xml: <${stack[stack.length - 1].tag}> is never closed`)
  for (const k of root.kids) if (typeof k !== 'string') k.parent = undefined
  return root.kids
}

/** Write one node back out, optionally with attributes changed on the way. */
export function write(n: El | string, edit?: (el: El) => Record<string, string> | null): string {
  if (typeof n === 'string') return escT(n)
  const attrs = edit ? edit(n) : n.attrs
  if (attrs === null) return ''
  let a = ''
  for (const k in attrs) a += ` ${k}="${escA(attrs[k])}"`
  return n.kids.length ? `<${n.tag}${a}>${n.kids.map((k) => write(k, edit)).join('')}</${n.tag}>` : `<${n.tag}${a}/>`
}

export const classes = (el: El): string[] => (el.attrs.class ?? '').split(/\s+/).filter(Boolean)

/** Inline style declarations, as a map. */
export function styleOf(el: El): Record<string, string> {
  const out: Record<string, string> = {}
  for (const d of (el.attrs.style ?? '').split(';')) {
    const k = d.indexOf(':')
    if (k > 0) out[d.slice(0, k).trim()] = d.slice(k + 1).trim()
  }
  return out
}

/** Every element under a node, depth first, in painting order. */
export function* walk(n: El): Generator<El> {
  yield n
  for (const k of n.kids) if (typeof k !== 'string') yield* walk(k)
}
