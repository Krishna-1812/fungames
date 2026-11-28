/**
 * The ground's photographed materials on the page (groundset.ts, terrain.ts): two array textures, one layer a
 * surface — its colour and height, and its normal, roughness and occlusion — streamed in after the island first
 * draws.
 *
 * Until they come, each layer is a single texel of its own measured mean (ground.json), so the ground is never
 * missing, only plain for a moment; then the photographs replace it in place (the shader is the same either way:
 * nothing recompiles). Each file is Basis Universal (KTX2), turned on the device into whatever compressed format its
 * graphics card reads (BC on a desktop, ASTC or ETC2 on a phone), so a layer costs a sixth of what plain pixels would;
 * and where memory is tight (a phone, the Low level) the largest mip is never uploaded at all.
 */
import {
  CompressedArrayTexture, type CompressedTexture, DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace,
  RepeatWrapping, RGBAFormat, SRGBColorSpace, type Texture, UnsignedByteType, type WebGLRenderer,
} from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { GROUND } from './groundset'

export type GroundTextures = {
  /** The shader's uniforms: the colour-and-height array, the normal-roughness-occlusion array. */
  colour: { value: Texture }; detail: { value: Texture }
  /** Whether the photographs are in (for the checks and the pictures). */
  ready: () => boolean
  dispose(): void
}

/** A placeholder array: one texel a layer. */
function plain(rgba: (k: number) => [number, number, number, number], srgb: boolean) {
  const n = GROUND.length, data = new Uint8Array(n * 4)
  for (let k = 0; k < n; k++) data.set(rgba(k), k * 4)
  const t = new DataArrayTexture(data, 1, 1, n)
  t.format = RGBAFormat; t.type = UnsignedByteType; t.magFilter = LinearFilter; t.minFilter = LinearFilter
  t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace; t.needsUpdate = true
  return t
}

/** Layers of one kind (all the same size and format), stacked into one array texture, level by level. */
function stack(layers: CompressedTexture[], drop: number, srgb: boolean, aniso: number) {
  const first = layers[0], levels = first.mipmaps!.length
  const mipmaps = [] as { data: Uint8Array; width: number; height: number }[]
  for (let l = drop; l < levels; l++) {
    const m0 = first.mipmaps![l] as { data: Uint8Array; width: number; height: number }
    const one = m0.data.byteLength, data = new Uint8Array(one * layers.length)
    layers.forEach((t, k) => data.set((t.mipmaps![l] as { data: Uint8Array }).data, k * one))
    mipmaps.push({ data, width: m0.width, height: m0.height })
  }
  const t = new CompressedArrayTexture(mipmaps, mipmaps[0].width, mipmaps[0].height, layers.length, first.format, first.type)
  t.wrapS = t.wrapT = RepeatWrapping
  t.minFilter = mipmaps.length > 1 ? LinearMipmapLinearFilter : LinearFilter; t.magFilter = LinearFilter
  t.anisotropy = aniso; t.generateMipmaps = false
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  t.needsUpdate = true
  return t
}

export function groundTextures(renderer: WebGLRenderer, opts: { base: string; small: boolean; aniso: number; colour?: { value: Texture | null }; detail?: { value: Texture | null }; onReady?: () => void }): GroundTextures {
  const dir = opts.base.replace(/\/?$/, '/') + 'walk-ground/'
  // (The uniforms' own holders, if the shader's are handed in: a texture swapped in is seen at once.)
  const colour = (opts.colour ?? { value: null }) as { value: Texture }, detail = (opts.detail ?? { value: null }) as { value: Texture }
  colour.value = plain(() => [128, 128, 128, 128], true); detail.value = plain(() => [128, 128, 200, 255], false)
  let ready = false, gone = false
  const loader = new KTX2Loader().setTranscoderPath(dir + 'basis/').setWorkerLimit(Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2)))).detectSupport(renderer)

  // The measured means first (a few hundred bytes), then the photographs.
  fetch(dir + 'ground.json').then((r) => r.json()).then((m: { layers: { key: string; mean?: [number, number, number] }[] }) => {
    if (gone) return
    const means = GROUND.map((g) => m.layers.find((l) => l.key === g.key)?.mean ?? [128, 128, 128])
    colour.value.dispose(); colour.value = plain((k) => [...means[k], 128] as [number, number, number, number], true)
  }).catch(() => {})
  const load = (s: 'c' | 'd') => Promise.all(GROUND.map((g) => loader.loadAsync(dir + `${g.key}-${s}.ktx2`) as Promise<CompressedTexture>))
  Promise.all([load('c'), load('d')]).then(([c, d]) => {
    if (gone) { for (const t of [...c, ...d]) t.dispose(); return }
    const drop = opts.small ? 1 : 0
    const ct = stack(c, drop, true, opts.aniso), dt = stack(d, drop, false, opts.aniso)
    for (const t of [...c, ...d]) t.dispose()
    colour.value.dispose(); detail.value.dispose()
    colour.value = ct; detail.value = dt
    ready = true
    loader.dispose()
    opts.onReady?.()
  }).catch((e) => console.warn('walk: the ground\'s photographs did not load; it stays plain', e))

  return {
    colour, detail, ready: () => ready,
    dispose() { gone = true; colour.value.dispose(); detail.value.dispose(); loader.dispose() },
  }
}
