/**
 * Which icons each game asks for, and what each page does to them.
 *
 * Derived from the games' own data rather than listed by hand, so it cannot go
 * stale: add a layer to Ambient Mix without drawing its icon and check-icons
 * fails on the next run rather than the page rendering a gap.
 *
 * The page colours and sizes here are facts about the CSS, read off the
 * stylesheets they belong to. They are what makes the checks mean anything —
 * an icon is only legible at a size, on a background, in an ink.
 */
import { LAYERS } from './mix-code'

export type Page = {
  /** The page background the icon is composited over. */
  bg: string
  /** The page's text colour, which the icon inherits as `currentColor`. */
  ink: string
  /** The rendered size in CSS pixels, from the rule that sizes it. */
  size: number
}

export const PAGES: Record<string, Page> = {
  // :global(.mix-body) { background: #0e1b28; color: #eaf1f7 } and .glyph { 26px }
  'ambient-mix': { bg: '#0e1b28', ink: '#eaf1f7', size: 26 },
  // .spend-body { background: #f2f6f4 } with the site's default ink, .glyph { 34px }
  'spend-it': { bg: '#f2f6f4', ink: '#241d12', size: 34 },
  // :global(.fold-body) { background: #faf6ea }, .mark-glyph { 26px }
  'paper-folds': { bg: '#faf6ea', ink: '#241d12', size: 26 },
}

export const USES: Record<string, string[]> = {
  'ambient-mix': LAYERS.map((l) => l.icon),
}
