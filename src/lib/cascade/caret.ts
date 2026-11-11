/**
 * Where a character is, inside a textarea.
 *
 * A textarea will not tell you: it is one box of text with no per-letter
 * geometry. So this keeps a hidden twin, a div with exactly the same font,
 * padding, width and wrapping, writes the text into it with the character of
 * interest in its own span, and measures the span. That is the standard way,
 * and the only one that wraps lines the way the textarea does.
 *
 * Indices are code points (Array.from), so an emoji is one character, the
 * same as everywhere else in Rule Cascade.
 */

const COPY = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
  'textTransform', 'wordSpacing', 'textIndent', 'tabSize',
] as const

export function caretMap(ta: HTMLTextAreaElement) {
  const twin = document.createElement('div')
  twin.setAttribute('aria-hidden', 'true')
  Object.assign(twin.style, {
    position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0',
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordWrap: 'break-word', borderStyle: 'solid',
  })
  document.body.appendChild(twin)
  const mark = document.createElement('span')

  /** The middle of character `i`, in viewport coordinates, and its size. */
  function at(i: number): { x: number; y: number; w: number; h: number } | null {
    const a = Array.from(ta.value)
    if (i < 0 || i >= a.length) return null
    const cs = getComputedStyle(ta)
    for (const k of COPY) (twin.style as any)[k] = cs[k]
    twin.textContent = a.slice(0, i).join('')
    mark.textContent = a[i]
    twin.appendChild(mark)
    twin.appendChild(document.createTextNode(a.slice(i + 1).join('') || ' '))
    const r = ta.getBoundingClientRect()
    return {
      x: r.left + mark.offsetLeft + mark.offsetWidth / 2 - ta.scrollLeft,
      y: r.top + mark.offsetTop + mark.offsetHeight / 2 - ta.scrollTop,
      w: mark.offsetWidth, h: mark.offsetHeight,
    }
  }

  return { at, dispose: () => twin.remove() }
}
