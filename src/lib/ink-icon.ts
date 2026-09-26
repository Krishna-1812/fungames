import { iconSvg } from './icons'

/**
 * An icon from lib/icons.ts drawn in ink only. The originals carry mid-tone
 * fills so they read on both cream and near-black pages; on a Paper & Ink
 * colour block those fills are exactly the stray tints the system bans, so
 * every literal colour becomes `currentColor` and the block's ink draws it.
 */
export const inkIcon = (key: string) =>
  iconSvg(key).replace(/\b(fill|stroke)="#[0-9a-fA-F]{3,8}"/g, '$1="currentColor"')
