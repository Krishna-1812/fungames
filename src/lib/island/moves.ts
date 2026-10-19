/**
 * Tiny Island — every motion on the map, as data.
 *
 * The island is drawn on a canvas (lib/island/engine), so its motions are
 * no longer CSS rules for a browser to run but a table for the engine to
 * play: which class moves, to which keyframes, for how long, round which
 * point. The keyframes themselves are written as CSS, because that is the
 * clearest way to write a keyframe, and are read once at build time.
 *
 * The cards under the map still draw each building as SVG, so the same
 * table is turned back into CSS for them (cardCss): one description of each
 * motion, two players.
 */

/** A CSS animation, as the shorthand would give it. */
export type Loop = {
  kf: string
  dur: number
  ease?: string
  delay?: number
  /** Iterations; Infinity by default. */
  iter?: number
  dir?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  fill?: 'none' | 'forwards' | 'backwards' | 'both'
}

/** When a rule applies: the page's time of day, season and hour. */
export type When = { time?: string[]; season?: string[]; hour?: number[] }

export type Rule = {
  /** Classes the element must have (all of them). */
  on: string[]
  /** A class some ancestor must have. */
  inside?: string
  loop?: Loop
  /** transform-box: fill-box; otherwise the element's own user space. */
  fillBox?: boolean
  /** transform-origin, as CSS writes it ('center', '0 100%', '50% 0%'). */
  origin?: string
  /** What the element looks like when no animation is playing on it. */
  base?: { opacity?: number; dash?: string; fill?: string; stroke?: string }
  when?: When
}

/** The keyframes, as CSS. Read at build time by keyframes.ts. */
export const KEYFRAMES = `
@keyframes isl-twinkle { 50% { transform: scale(0.5); opacity: 0.45; } }
@keyframes isl-frame24 { 0%, 4.17% { opacity: 1; } 4.2%, 97.9% { opacity: 0; } 100% { opacity: 1; } }
@keyframes isl-stride { 0%, 12.4% { opacity: 1; } 12.5%, 100% { opacity: 0; } }
@keyframes nat-sheep-up { 0%, 49.9% { opacity: 0; } 50%, 87.9% { opacity: 1; } 88%, 100% { opacity: 0; } }
@keyframes nat-sheep-down { 0%, 49.9% { opacity: 1; } 50%, 87.9% { opacity: 0; } 88%, 100% { opacity: 1; } }
@keyframes nat-deer-up { 0%, 14.9% { opacity: 0; } 15%, 84.9% { opacity: 1; } 85%, 100% { opacity: 0; } }
@keyframes nat-deer-down { 0%, 14.9% { opacity: 1; } 15%, 84.9% { opacity: 0; } 85%, 100% { opacity: 1; } }
@keyframes isl-wing2 { 0%, 49.9% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes isl-pulse { 50% { transform: scale(1.35); opacity: 0.2; } }
@keyframes isl-spin { to { transform: rotate(360deg); } }
@keyframes isl-bob { 50% { transform: translateY(-4px); } }
@keyframes isl-drift { 50% { transform: translateX(10px); } }
@keyframes isl-puff { 0% { transform: translate(0, 0) scale(0.4); opacity: 0.95; } 100% { transform: translate(8px, -44px) scale(1.8); opacity: 0; } }
@keyframes isl-blink { 50% { opacity: 0.2; } }
@keyframes isl-chase { 50% { fill: #ff4f6e; } }
@keyframes isl-rain { from { transform: translateY(-6px); opacity: 0; } 30% { opacity: 1; } to { transform: translateY(20px); opacity: 0; } }
@keyframes isl-bubble { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-46px); opacity: 0; } }
@keyframes isl-flutter { 50% { transform: scaleX(0.82) skewY(6deg); } }
@keyframes isl-pop-up { 0% { opacity: 0; } 30%, 100% { opacity: 1; } }
@keyframes isl-glide { 50% { transform: translate(14px, -8px); } }
@keyframes isl-swim { 50% { transform: translateX(18px); } }
@keyframes isl-quiver { 50% { transform: translateY(-1px); } }
@keyframes isl-arm { 50% { transform: rotate(-35deg); } }
@keyframes isl-jetski { 50% { transform: translate(-40px, 16px); } }
@keyframes isl-surf { 0%, 100% { opacity: 0; } 35% { opacity: 0.6; } 70% { opacity: 0.08; } }
@keyframes isl-shim { 0%, 100% { opacity: 0; } 30%, 45% { opacity: 0.8; } }
@keyframes isl-ripple { 0% { transform: scale(0.5); opacity: 0; } 18% { opacity: 0.9; } 100% { transform: scale(1.55); opacity: 0; } }
@keyframes isl-glint { 0%, 55%, 100% { opacity: 0; transform: scale(0.3); } 72% { opacity: 0.95; transform: scale(1); } }
@keyframes isl-flow { to { stroke-dashoffset: -9; } }
@keyframes isl-spray { to { stroke-dashoffset: -7; } }
@keyframes isl-fish { 0%, 70% { transform: translate(0, 0) rotate(0); opacity: 0; } 74% { opacity: 1; } 80% { transform: translate(14px, -22px) rotate(-30deg); } 86% { transform: translate(28px, 0) rotate(30deg); opacity: 1; } 88%, 100% { opacity: 0; transform: translate(28px, 0); } }
@keyframes isl-step { to { transform: translateX(1.4px) translateY(-0.6px); } }
@keyframes isl-cloud { from { transform: translateX(-900px); } to { transform: translateX(1400px); } }
@keyframes isl-flock { from { transform: translate(-1100px, 300px); } to { transform: translate(1300px, -500px); } }
@keyframes isl-flap { to { transform: scaleY(0.45); } }
@keyframes nat-graze { 0%, 45%, 100% { transform: rotate(0); } 55%, 85% { transform: rotate(-28deg) translateY(-1px); } }
@keyframes nat-look { 0%, 100% { transform: rotate(48deg); } 30%, 70% { transform: rotate(0); } }
@keyframes nat-scuttle { 0%, 100% { transform: translate(0, 0); } 20% { transform: translate(-12px, -6px); } 25%, 55% { transform: translate(-12px, -6px); } 75% { transform: translate(10px, 5px); } 80% { transform: translate(10px, 5px); } }
@keyframes nat-leap { 0%, 62% { opacity: 0; transform: translate(-24px, 10px) rotate(-35deg); } 64% { opacity: 1; } 72% { transform: translate(0, -26px) rotate(0); } 80% { opacity: 1; transform: translate(24px, 8px) rotate(40deg); } 82%, 100% { opacity: 0; transform: translate(24px, 10px) rotate(40deg); } }
@keyframes nat-ring { 0%, 62% { opacity: 0; transform: scale(0.4); } 64% { opacity: 0.8; } 76% { opacity: 0; transform: scale(1.4); } 80% { opacity: 0.8; transform: scale(0.5) translateX(30px); } 92%, 100% { opacity: 0; transform: scale(1.4) translateX(20px); } }
@keyframes nat-blow { 0%, 70% { opacity: 0; transform: scaleY(0.2); } 74% { opacity: 1; } 90% { opacity: 0.9; transform: scaleY(1); } 100% { opacity: 0; transform: scaleY(1.1); } }
@keyframes nat-flit { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(10px, -6px); } 50% { transform: translate(4px, -12px); } 75% { transform: translate(-9px, -4px); } }
@keyframes nat-wing { to { transform: scaleX(0.3); } }
@keyframes nat-roll { 0%, 100% { transform: translate(-36px, 10px); } 50% { transform: translate(36px, -8px); } }
@keyframes nat-spurt { 50% { transform: scaleY(1.4); } }
@keyframes town-kite { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-4deg) translateY(-3px); } }
@keyframes town-swing { 0%, 100% { transform: rotate(28deg); } 50% { transform: rotate(-28deg); } }
@keyframes town-moor { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(1.6px) rotate(2deg); } }
@keyframes town-bob { 0%, 70%, 100% { transform: translateY(0); } 76% { transform: translateY(3px); } 82% { transform: translateY(-1px); } }
@keyframes town-flame { to { transform: scale(0.85, 1.15) skewX(4deg); } }
@keyframes town-spark { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(4px, -26px); opacity: 0; } }
@keyframes sky-plane { 0% { transform: translate(-1500px, 1130px) rotate(-7deg); } 42% { transform: translate(1500px, 760px) rotate(-7deg); } 42.01%, 100% { transform: translate(1500px, -2400px) rotate(-7deg); } }
@keyframes sky-prop { to { transform: scaleY(0.2); } }
@keyframes isl-beam { from { transform: scaleY(0.5) rotate(0deg); } to { transform: scaleY(0.5) rotate(360deg); } }
@keyframes isl-sift { from { transform: translateY(0); } to { transform: translateY(100%); } }
@keyframes isl-rise { from { transform: translateY(0); } to { transform: translateY(-100%); } }
@keyframes isl-moonpath { 50% { opacity: 0.35; } }
@keyframes isl-fw { 0% { transform: scale(0.15); opacity: 0; } 8% { opacity: 1; } 55% { transform: scale(1); opacity: 0.9; } 80%, 100% { transform: scale(1.12) translateY(6px); opacity: 0; } }
@keyframes sky-firefly { 0%, 100% { opacity: 0; transform: translate(0, 0); } 30% { opacity: 1; } 50% { opacity: 0.3; transform: translate(9px, -7px); } 70% { opacity: 1; } 85% { transform: translate(-4px, 4px); } }
@keyframes se-climb { 0%, 8% { transform: translateY(110px); } 50%, 58% { transform: translateY(-420px); } 100% { transform: translateY(110px); } }
@keyframes cd-draw { 0% { opacity: 0; } 30%, 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes uf-eclipse { 0% { transform: translateX(-36px); } 50% { transform: translateX(0); } 100% { transform: translateX(36px); } }
@keyframes sp-spin { to { transform: translateX(64px); } }
@keyframes sp-line { to { stroke-dashoffset: -18; } }
@keyframes ast-fall { 0% { transform: translate(-100px, -150px); opacity: 0; } 10% { opacity: 1; } 42% { transform: translate(0, 0); opacity: 1; } 44%, 100% { transform: translate(0, 0); opacity: 0; } }
@keyframes ast-ring { 0%, 42% { transform: scale(0.2); opacity: 0; } 44% { opacity: 1; } 75%, 100% { transform: scale(1.9); opacity: 0; } }
@keyframes dsi-shake { 0%, 90%, 100% { transform: none; } 91% { transform: translate(-2px, 1px); } 93% { transform: translate(2px, -1px); } 95% { transform: translate(-2px, 0); } 97% { transform: translate(1px, 1px); } }
@keyframes ds-dive { 50% { transform: translateY(40px); } }
@keyframes am-ring { 0% { transform: scale(0.3); opacity: 0.9; } 100% { transform: scale(2.8); opacity: 0; } }
@keyframes stp-morse { 0%, 4% { opacity: 1; } 5%, 9% { opacity: 0; } 10%, 14% { opacity: 1; } 15%, 19% { opacity: 0; } 20%, 24% { opacity: 1; } 25%, 29% { opacity: 0; } 30%, 34% { opacity: 1; } 35%, 49% { opacity: 0; } 50%, 54% { opacity: 1; } 55%, 59% { opacity: 0; } 60%, 64% { opacity: 1; } 65%, 100% { opacity: 0; } }
@keyframes au-knock { 0%, 70%, 100% { transform: rotate(0); } 80% { transform: rotate(-28deg); } 86% { transform: rotate(6deg); } }
@keyframes au-pop { 0%, 84% { transform: scale(0); } 90%, 100% { transform: scale(1); } }
@keyframes pm-roll { to { transform: translateX(0.3px); } }
@keyframes er-glow { 50% { transform: scale(1.3); } }
@keyframes isl-neon { 0%, 91%, 94%, 100% { opacity: 1; } 92% { opacity: 0.45; } 95% { opacity: 0.75; } }
@keyframes rc-tick { 0% { opacity: 0; } 20%, 100% { opacity: 1; } }
@keyframes fm-draw { 0% { stroke-dashoffset: 170; } 60%, 100% { stroke-dashoffset: 0; } }
@keyframes nar-lift { 0%, 40%, 100% { transform: rotate(0); } 55%, 85% { transform: rotate(58deg); } }
@keyframes nar-tick { 0%, 20% { stroke-dashoffset: 22; } 40%, 100% { stroke-dashoffset: 0; } }
@keyframes nar-light { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.25; } }
@keyframes sh-walk { 0% { transform: translateX(-44px) rotate(-6deg); } 25% { transform: translateX(-20px) rotate(8deg); } 50% { transform: translateX(38px) rotate(-5deg); } 75% { transform: translateX(10px) rotate(8deg); } 100% { transform: translateX(-44px) rotate(-6deg); } }
@keyframes tr-lever { 0%, 30% { transform: rotate(0); } 31%, 100% { transform: rotate(-40deg); } }
@keyframes pk-say { 0% { opacity: 0; transform: translateY(4px); } 12%, 75% { opacity: 1; transform: none; } 100% { opacity: 0; } }
@keyframes pk-dive { 30% { transform: translateY(10px); opacity: 0.25; } 55% { transform: translateY(14px); opacity: 0; } 80% { transform: translateY(-5px); opacity: 1; } }
@keyframes pk-hop { 25% { transform: translateY(-9px); } 50% { transform: none; } 70% { transform: translateY(-4px); } }
@keyframes pk-rise { 30% { transform: translateY(-110px); } }
@keyframes pk-scurry { 30%, 60% { transform: translateX(26px); } }
@keyframes pk-jet { 30% { transform: scaleY(3.4); } }
@keyframes pk-loop { to { transform: rotate(360deg); } }
@keyframes pk-leap { 40% { transform: translate(8px, -26px) rotate(-10deg); } }
@keyframes pk-flyoff { 30%, 70% { transform: translate(30px, -40px); opacity: 0; } }
@keyframes pk-run { 35%, 65% { transform: translateX(-34px); } }
@keyframes pk-jiggle { 25% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } 75% { transform: rotate(-3deg); } }
@keyframes pk-zip { 25%, 70% { transform: translate(260px, -220px) scale(0.4); opacity: 0; } }
@keyframes pk-breach { 0%, 100% { transform: translateY(18px) scaleY(0.4); opacity: 0; } 20%, 60% { transform: none; opacity: 1; } 80% { transform: translateY(18px) scaleY(0.4); opacity: 0; } }
@keyframes isl-march { to { stroke-dashoffset: -12; } }
@keyframes isl-pop { from { transform: translateY(-60px) scaleY(0.6); opacity: 0; } 60% { opacity: 1; } }
`

const L = (kf: string, dur: number, ease = 'ease', more: Partial<Loop> = {}): Loop => ({ kf, dur, ease, ...more })
const NIGHT_ONLY: When = { time: ['night'] }

/**
 * Every class on the map that moves, or that looks different from what its
 * markup says. Order matters only where two rules set the same thing on one
 * element: the later wins, as in CSS.
 */
export const RULES: Rule[] = [
  /* ---- small, general-purpose loops ---- */
  { on: ['twinkle'], loop: L('isl-twinkle', 2.4, 'ease-in-out'), fillBox: true, origin: 'center' },
  { on: ['pulse'], loop: L('isl-pulse', 2.4, 'ease-in-out'), fillBox: true, origin: 'center' },
  { on: ['spin'], loop: L('isl-spin', 16, 'linear'), fillBox: true, origin: 'center' },
  { on: ['spin-slow'], loop: L('isl-spin', 6, 'linear'), fillBox: true, origin: 'center' },
  { on: ['spin-rev'], loop: L('isl-spin', 16, 'linear', { dir: 'reverse' }) },
  { on: ['bob'], loop: L('isl-bob', 3.6, 'ease-in-out') },
  { on: ['drift'], loop: L('isl-drift', 7, 'ease-in-out') },
  { on: ['puff'], loop: L('isl-puff', 3, 'ease-out'), base: { opacity: 0 }, fillBox: true, origin: 'center' },
  { on: ['blink'], loop: L('isl-blink', 1, 'steps(2, jump-none)') },
  { on: ['blink-slow'], loop: L('isl-blink', 2.2, 'steps(2, jump-none)') },
  { on: ['chase'], loop: L('isl-chase', 1, 'steps(2, jump-none)') },
  { on: ['rain'], loop: L('isl-rain', 0.8, 'linear') },
  { on: ['bubble'], loop: L('isl-bubble', 2.8, 'ease-in'), base: { opacity: 0 } },
  { on: ['flutter'], loop: L('isl-flutter', 1.2, 'ease-in-out'), fillBox: true, origin: '0 50%' },
  { on: ['pop'], loop: L('isl-pop-up', 2.1, 'steps(1)') },
  { on: ['glide'], loop: L('isl-glide', 5, 'ease-in-out') },
  { on: ['swim'], loop: L('isl-swim', 6, 'ease-in-out') },
  { on: ['quiver'], loop: L('isl-quiver', 0.3, 'linear') },
  { on: ['wave-arm'], loop: L('isl-arm', 1.4, 'ease-in-out'), fillBox: true, origin: '0 100%' },
  { on: ['jetski'], loop: L('isl-jetski', 9, 'ease-in-out') },

  /* ---- the sea, the people, the sky ---- */
  // The sea's marks stand still: the browser would repaint the whole map
  // for a mark that crossed it.
  { on: ['wave'], base: { opacity: 0.5 } },
  { on: ['w1'], base: { opacity: 0.32 } },
  { on: ['w3'], base: { opacity: 0.32 } },
  // Sun on the water: a glint swells and goes, here and there. Not at night.
  { on: ['shim'], loop: L('isl-shim', 6, 'ease-in-out'), base: { opacity: 0 }, when: { time: ['dawn', 'day', 'dusk'] } },
  { on: ['glint'], loop: L('isl-glint', 5, 'ease-in-out'), base: { opacity: 0 }, fillBox: true, origin: 'center', when: { time: ['dawn', 'day', 'dusk'] } },
  // White water running down each fall of the river, and up out of the
  // fountain. (Until the map moved to a canvas these named the keyframes
  // that slid the weather down the map, and flew off with it.)
  // Rings spreading out round whatever sits in the water: a buoy, a rock, a moored boat, a duck.
  { on: ['ripple'], loop: L('isl-ripple', 3.6, 'ease-out'), base: { opacity: 0 }, fillBox: true, origin: 'center' },
  { on: ['fall'], loop: L('isl-flow', 0.55, 'linear') },
  { on: ['fish'], loop: L('isl-fish', 7, 'ease-in-out'), base: { opacity: 0 } },
  // A walker's stride (lib/island/actors.ts): its eight frames, each shown in turn.
  { on: ['stride'], loop: L('isl-stride', 0.5, 'linear'), base: { opacity: 0 } },
  // Something turning (the globe at How Fast): its 24 frames, each shown for half a second, the next fading in over it.
  { on: ['frame24'], loop: L('isl-frame24', 12, 'linear'), base: { opacity: 0 } },
  // Unity's animals (lib/island/actors.ts): a sheep or a deer looking up now and then, a bird's wings up and down.
  { on: ['sheep-up'], loop: L('nat-sheep-up', 6, 'linear'), base: { opacity: 0 } },
  { on: ['sheep-down'], loop: L('nat-sheep-down', 6, 'linear') },
  { on: ['deer-up'], loop: L('nat-deer-up', 8, 'linear'), base: { opacity: 0 } },
  { on: ['deer-down'], loop: L('nat-deer-down', 8, 'linear') },
  { on: ['wing2'], loop: L('isl-wing2', 0.42, 'linear') },
  { on: ['leg-a'], inside: 'walker', loop: L('isl-step', 0.5, 'ease-in-out', { dir: 'alternate' }) },
  { on: ['leg-b'], inside: 'walker', loop: L('isl-step', 0.5, 'ease-in-out', { dir: 'alternate-reverse' }) },
  { on: ['cloud'], loop: L('isl-cloud', 160, 'linear') },
  { on: ['flock'], loop: L('isl-flock', 38, 'linear') },
  { on: ['flock1'], loop: L('isl-flock', 52, 'linear') },
  { on: ['flap'], loop: L('isl-flap', 0.5, 'ease-in-out', { dir: 'alternate' }), fillBox: true, origin: 'center' },

  /* ---- the wild things ---- */
  { on: ['mill-sails'], loop: L('isl-spin', 9, 'linear'), fillBox: true, origin: 'center' },
  { on: ['sheep-head'], loop: L('nat-graze', 6, 'ease-in-out'), fillBox: true, origin: '0% 30%' },
  { on: ['deer-head'], loop: L('nat-look', 8, 'ease-in-out'), fillBox: true, origin: '0% 100%' },
  { on: ['crab'], loop: L('nat-scuttle', 7, 'ease-in-out') },
  { on: ['dolphin'], loop: L('nat-leap', 9, 'ease-in-out'), base: { opacity: 0 } },
  { on: ['dol-ring'], loop: L('nat-ring', 9, 'ease-out'), fillBox: true, origin: 'center' },
  { on: ['whale-spout'], loop: L('nat-blow', 7, 'ease-out'), base: { opacity: 0 }, fillBox: true, origin: '50% 100%' },
  { on: ['bfly'], loop: L('nat-flit', 7, 'ease-in-out') },
  { on: ['bfly-wings'], loop: L('nat-wing', 0.28, 'ease-in-out', { dir: 'alternate' }), fillBox: true, origin: 'center' },
  { on: ['tumble'], loop: L('nat-roll', 12, 'ease-in-out') },
  { on: ['tumble-ball'], loop: L('isl-spin', 3, 'linear'), fillBox: true, origin: 'center' },

  /* ---- town life ---- */
  // One period of the spray's dashes (3 4) a loop, so it runs on without a jump.
  { on: ['fount'], loop: L('isl-spray', 0.7, 'linear') },
  { on: ['fount-up'], loop: L('nat-spurt', 1.4, 'ease-in-out'), fillBox: true, origin: '50% 100%' },
  { on: ['kite'], loop: L('town-kite', 5, 'ease-in-out'), fillBox: true, origin: '0% 100%' },
  { on: ['swing'], loop: L('town-swing', 2.2, 'ease-in-out'), fillBox: true, origin: '50% 0%' },
  { on: ['moored'], loop: L('town-moor', 3.4, 'ease-in-out'), fillBox: true, origin: '50% 100%' },
  { on: ['bobber'], loop: L('town-bob', 2.6, 'ease-in-out') },
  { on: ['flame'], loop: L('town-flame', 0.5, 'ease-in-out', { dir: 'alternate' }), fillBox: true, origin: '50% 100%' },
  { on: ['spark'], loop: L('town-spark', 2.6, 'ease-out'), base: { opacity: 0 } },

  /* ---- the sky ---- */
  { on: ['isl-plane'], loop: L('sky-plane', 70, 'linear', { delay: -20 }) },
  { on: ['prop'], inside: 'isl-plane', loop: L('sky-prop', 0.12, 'linear', { dir: 'alternate' }), fillBox: true, origin: 'center' },
  { on: ['tow'], inside: 'isl-plane', loop: L('isl-flutter', 0.9, 'ease-in-out'), fillBox: true, origin: '100% 50%' },

  /* ---- after dark ---- */
  { on: ['star-twinkle'], loop: L('isl-blink', 2.6, 'steps(2, jump-none)') },
  { on: ['moon-path'], loop: L('isl-moonpath', 4, 'ease-in-out') },
  { on: ['fw'], loop: L('isl-fw', 4.2, 'ease-out'), base: { opacity: 0 }, fillBox: true, origin: 'center' },
  { on: ['firefly'], loop: L('sky-firefly', 4.5, 'ease-in-out'), base: { opacity: 0 }, when: NIGHT_ONLY },

  /* ---- each building's own motion ---- */
  { on: ['se-pod'], loop: L('se-climb', 8, 'ease-in-out') },
  { on: ['cd-lines'], loop: L('cd-draw', 5, 'ease-in-out') },
  { on: ['uf-shadow'], loop: L('uf-eclipse', 9, 'ease-in-out') },
  { on: ['sp-spin'], loop: L('sp-spin', 6, 'linear') },
  { on: ['speedline'], loop: L('sp-line', 0.5, 'linear'), base: { dash: '10 8' } },
  { on: ['ast-meteor'], loop: L('ast-fall', 5, 'cubic-bezier(0.5, 0, 1, 1)') },
  { on: ['ast-ring'], loop: L('ast-ring', 5, 'ease-out'), base: { opacity: 0 }, fillBox: true, origin: 'center' },
  { on: ['dsi-quake'], loop: L('dsi-shake', 6, 'linear') },
  { on: ['ds-drop'], loop: L('ds-dive', 7, 'ease-in-out') },
  { on: ['am-ring'], loop: L('am-ring', 2.4, 'ease-out'), base: { opacity: 0 }, fillBox: true, origin: 'center' },
  // The lighthouse flashes "HI" in real Morse timing: .... ..
  { on: ['stp-beam'], loop: L('stp-morse', 4.8, 'linear'), base: { opacity: 0 } },
  { on: ['stp-arc'], loop: L('isl-blink', 1.2, 'steps(2, jump-none)') },
  { on: ['au-gavel'], loop: L('au-knock', 3, 'ease-in'), fillBox: true, origin: '50% 100%' },
  { on: ['au-sold'], loop: L('au-pop', 3, 'cubic-bezier(0.34, 1.56, 0.64, 1)'), fillBox: true, origin: '0 100%' },
  { on: ['pm-bills'], loop: L('pm-roll', 2, 'linear') },
  { on: ['er-star'], loop: L('er-glow', 1.6, 'ease-in-out'), fillBox: true, origin: 'center' },
  { on: ['ia-line'], loop: L('isl-blink', 1.4, 'steps(2, jump-none)') },
  // Neon flickers now and then, the way neon does.
  { on: ['neon'], loop: L('isl-neon', 5, 'steps(1)') },
  { on: ['dg-shadow'], loop: L('isl-spin', 14, 'linear') },
  { on: ['es-win', 'lit'], base: { fill: '#ffe9a8' } },
  { on: ['rc-tick'], loop: L('rc-tick', 3, 'steps(1)') },
  { on: ['rc-moth'], loop: L('isl-spin', 3, 'linear') },
  { on: ['fm-draw'], loop: L('fm-draw', 4.5, 'ease-in-out'), base: { dash: '170' } },
  { on: ['nar-bar'], loop: L('nar-lift', 4, 'ease-in-out') },
  { on: ['nar-tick'], loop: L('nar-tick', 4, 'ease-in-out'), base: { dash: '22' } },
  { on: ['nar-stop'], loop: L('nar-light', 4, 'steps(1)') },
  { on: ['nar-go'], loop: L('nar-light', 4, 'steps(1)', { dir: 'reverse' }) },
  { on: ['sh-walk'], loop: L('sh-walk', 7, 'ease-in-out') },
  { on: ['tr-lever'], loop: L('tr-lever', 6, 'steps(1)'), fillBox: true, origin: '0 100%' },
  { on: ['robot'], loop: L('isl-bob', 1.8, 'ease-in-out') },
  { on: ['breach'], loop: L('pk-breach', 6, 'ease-in-out'), fillBox: true, origin: '50% 100%' },

  /* ---- things to poke ---- */
  // A poke's words wait, unseen, for the poke.
  { on: ['pk-say'], base: { opacity: 0 } },
]

/**
 * What a poke does: a reaction played once on the thing itself (round the
 * middle of its foot), and on some of what is inside it. Every poke with
 * words also shows them (pk-say, below). The engine plays these; the page
 * only says which thing was poked.
 */
export type Poke = { self?: Loop; inner?: { on: string; loop?: Loop; speed?: number; not?: string }[] }
export const POKE_SAY: Loop = L('pk-say', 2.4, 'ease-out', { iter: 1 })
/** How long a poke counts as just poked (a second poke restarts it). */
export const POKE_MS = 5200
const once = (kf: string, dur: number, ease: string): Loop => L(kf, dur, ease, { iter: 1 })
export const POKES: Record<string, Poke> = {
  whale: { self: once('pk-dive', 2.6, 'ease-in-out') },
  dawnwhale: { self: once('pk-dive', 2.6, 'ease-in-out') },
  sheep: { self: once('pk-hop', 0.9, 'ease-out') },
  duck: { self: once('pk-hop', 0.9, 'ease-out') },
  castaway: { self: once('pk-hop', 0.9, 'ease-out') },
  bottle: { self: once('pk-hop', 0.9, 'ease-out') },
  ferry: { self: once('pk-hop', 0.9, 'ease-out') },
  // The windmill's sails spin twenty times as fast for a while.
  windmill: { inner: [{ on: 'mill-sails', speed: 9 / 0.45 }] },
  balloon: { self: once('pk-rise', 5, 'ease-in-out') },
  crab: { self: once('pk-scurry', 1.6, 'ease-in-out') },
  fountain: { inner: [{ on: 'fount-up', loop: once('pk-jet', 1.6, 'ease-out') }] },
  kite: { inner: [{ on: 'kite', loop: once('pk-loop', 1.4, 'ease-in-out') }] },
  dolphin: { self: once('pk-leap', 1.4, 'ease-out') },
  // The gull flies off and comes back; its squawk stays where it was.
  gull: { inner: [{ on: '*', not: 'pk-say', loop: once('pk-flyoff', 3, 'ease-in-out') }] },
  deer: { self: once('pk-run', 2.4, 'ease-in-out') },
  treasure: { self: once('pk-jiggle', 0.8, 'ease-in-out') },
  house32: { self: once('pk-jiggle', 0.8, 'ease-in-out') },
  notice: { self: once('pk-jiggle', 0.8, 'ease-in-out') },
  ufo: { self: once('pk-zip', 3.4, 'ease-in-out') },
}
/** The origin a poke's own reaction turns and lifts round: the foot of what was poked. */
export const POKE_ORIGIN = '50% 100%'
/** Inner reactions turn round the middle of what they move (CSS: transform-box: fill-box). */
export const POKE_INNER_ORIGIN: Record<string, string> = { 'fount-up': '50% 100%', kite: '50% 50%' }

/**
 * The buildings: how they lift when you point at one, the dashed ring
 * that marches round its foot, how far the rest fade when a filter leaves
 * them out, and how each drops in when the page opens.
 */
export const LANDMARK = {
  lift: 9,
  liftMs: 450,
  liftEase: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  ringMs: 250,
  ringMarch: L('isl-march', 1, 'linear'),
  dim: 0.25,
  dimMs: 350,
  intro: L('isl-pop', 0.8, 'cubic-bezier(0.34, 1.56, 0.64, 1)', { iter: 1, fill: 'backwards', delay: 0.25 }),
  /** Dinosaur Time's fossil blinks three times when you point at it. */
  hoverBlink: { on: 'dt-fossil', loop: L('isl-blink', 0.6, 'steps(2, jump-none)', { iter: 3 }) },
}

/**
 * The whole layers that move or change by themselves: the surf rolling in,
 * the night coming on, the lighthouse's beam, the weather.
 */
export const LAYERS = {
  surfOut: { opacity: 0.35, loop: L('isl-surf', 5.2, 'ease-in-out') },
  surfIn: { opacity: 0.35, loop: L('isl-surf', 5.2, 'ease-in-out', { delay: 1.6 }) },
  beam: { loop: L('isl-beam', 10, 'linear'), when: { time: ['night', 'dusk'] } as When, dusk: 0.5 },
  snow: { loop: L('isl-sift', 40, 'linear'), when: { season: ['winter', 'newyear'] } as When },
  petals: { loop: L('isl-sift', 70, 'linear'), when: { season: ['spring'] } as When },
  // The rest of the island's calendar (lib/island/seasons.ts says when each one is).
  rain: { loop: L('isl-sift', 5, 'linear'), when: { season: ['monsoon'] } as When },
  powder: { loop: L('isl-sift', 95, 'linear'), when: { season: ['holi'] } as When },
  // Sky lanterns go up, not down, and only once it is dark enough to see them glow.
  lanterns: { loop: L('isl-rise', 80, 'linear'), when: { season: ['diwali'], time: ['night', 'dusk'] } as When },
  // New Year, Diwali, and Friday nights from eight to ten (the page says when: see 'fest' in the engine).
  fireworks: { when: { season: ['newyear', 'diwali', 'fest'], time: ['night', 'dusk'] } as When },
  ufo: { when: { hour: [3] } as When },
  dawnWhale: { when: { time: ['dawn'] } as When },
  nightDim: { when: NIGHT_ONLY },
  /** How the night comes on: a veil, then the lights, each with its own strength. */
  night: {
    fadeMs: 1600,
    veil: { night: ['#111a58', 0.58], dusk: ['#6a3f9e', 0.26], dawn: ['#d48fd8', 0.14] } as Record<string, [string, number]>,
    halos: { night: 1, dusk: 0.55, dawn: 0.25 } as Record<string, number>,
    cores: { night: 0.8, dusk: 0.55, dawn: 0.25 } as Record<string, number>,
    panes: { night: 1, dusk: 0.7 } as Record<string, number>,
    shine: { night: 1, dusk: 0.7 } as Record<string, number>,
    sky: { night: 1 } as Record<string, number>,
    /**
     * The realistic island's night (a Unity render under it): the day's picture multiplied down to
     * moonlight, a little of its colour taken out (night vision sees less of it), and then the
     * light of the island's own lamps and windows (Unity's, again) laid over it.
     */
    real: {
      multiply: { night: ['#4a5c9c', 1], dusk: ['#a993d4', 1], dawn: ['#e3c9ee', 1] } as Record<string, [string, number]>,
      saturation: { night: ['#808080', 0.5], dusk: ['#808080', 0.18], dawn: ['#808080', 0.08] } as Record<string, [string, number]>,
    },
    glow: { night: 1, dusk: 0.55, dawn: 0.2 } as Record<string, number>,
    /** The drawn island's night: the same two veils as the realistic one, in its own colours. */
    toon: {
      multiply: { night: ['#6272b4', 1], dusk: ['#c4abe8', 1], dawn: ['#efd9f0', 1] } as Record<string, [string, number]>,
      saturation: { night: ['#808080', 0.25], dusk: ['#808080', 0.08], dawn: ['#808080', 0.04] } as Record<string, [string, number]>,
    },
  },
  /** Clouds: thinner and dusky at night, faint when you are close. */
  cloud: { night: 0.55, near: 0.18, fadeMs: 400, puff: { night: '#7f8fc4', dusk: '#e9defa' } as Record<string, string>, base: { night: '#6a79b0', dusk: '#cdbdf0' } as Record<string, string> },
}

/* ---- the cards: the same motions, as CSS, for the buildings drawn as SVG ---- */

const cssLoop = (l: Loop) => `${l.kf} ${l.dur}s ${l.ease ?? 'ease'}${l.delay ? ` ${l.delay}s` : ''} ${l.iter === undefined ? 'infinite' : l.iter}${l.dir && l.dir !== 'normal' ? ` ${l.dir}` : ''}${l.fill && l.fill !== 'none' ? ` ${l.fill}` : ''}`

/**
 * CSS for the buildings on the cards under the map (each an SVG copy of its
 * building, in an element with the class `scope`): every rule in RULES that
 * needs no time of day, under that class, and the keyframes they use.
 * Inline animation-delay and transform-origin on the elements still apply,
 * because shorthand here sets only what a rule says.
 */
export function cardCss(scope: string, markup = '', more = ''): string {
  // Whatever the markup animates by an inline style of its own (a motion path), from the other keyframes given.
  const used = new Set<string>([...markup.matchAll(/animation(?:-name)?:\s*([\w-]+)/g)].map((m) => m[1]))
  let css = ''
  for (const r of RULES) {
    if (r.when) continue
    const sel = `${scope} ${r.inside ? `.${r.inside} ` : ''}${r.on.map((c) => `.${c}`).join('')}`
    const decl: string[] = []
    if (r.loop) {
      used.add(r.loop.kf)
      // The longhands, so an element's own inline animation-delay still wins.
      const l = r.loop
      decl.push(`animation-name:${l.kf}`, `animation-duration:${l.dur}s`, `animation-timing-function:${l.ease ?? 'ease'}`, `animation-iteration-count:${l.iter === undefined ? 'infinite' : l.iter}`)
      if (l.dir && l.dir !== 'normal') decl.push(`animation-direction:${l.dir}`)
      if (l.fill && l.fill !== 'none') decl.push(`animation-fill-mode:${l.fill}`)
      if (l.delay) decl.push(`animation-delay:${l.delay}s`)
    }
    if (r.fillBox) decl.push('transform-box:fill-box')
    if (r.origin) decl.push(`transform-origin:${r.origin}`)
    if (r.base?.opacity !== undefined) decl.push(`opacity:${r.base.opacity}`)
    if (r.base?.dash) decl.push(`stroke-dasharray:${r.base.dash}`)
    if (r.base?.fill) decl.push(`fill:${r.base.fill}`)
    if (decl.length) css += `${sel}{${decl.join(';')}}`
  }
  const kf = (KEYFRAMES + more).split('@keyframes').map((s) => s.trim()).filter((s) => used.has(s.split(/[\s{]/)[0])).map((s) => `@keyframes ${s}`).join('')
  return kf + css
}
export { cssLoop }
