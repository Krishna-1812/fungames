/**
 * What the walk's surfaces give back of the light on them (their albedo), held to what real surfaces do.
 *
 * Nothing painted, built or grown gives back all the light on it: fresh white paint about 0.8, new concrete 0.35,
 * asphalt under 0.12, grass about 0.2, dry sand 0.4 (fresh snow, about 0.85, is the brightest thing outdoors). The
 * island's colours came from a cartoon map, whose whites are pure white (1.0): in real light they glare. So every
 * lit material's colour passes through one rule, here, in the shader all of them share (three's
 * lights_physical_fragment, so none of the walk's own material patches need touching): up to 0.62 it is left as it
 * is; above, it is eased (keeping its hue, by scaling all three channels alike) towards 0.86 and never past it.
 * Metals keep their colour (theirs is a reflection, not a diffuse albedo). At the other end nothing real is
 * blacker than about 0.03 (black paint, rubber, fresh asphalt): darker colours are lifted to it, their hue kept.
 *
 * ?debug=albedo shows the albedo itself, unlit: in grey where it was within range already, tinted magenta by how
 * much it had to be brought down, blue where it is darker than anything real (under 0.02) — and __walk.albedo()
 * counts each over the picture (for the checks).
 */
import { ShaderChunk } from 'three'

/** Where the easing starts, and the ceiling it approaches. */
export const KNEE = 0.62, CEILING = 0.86, FLOOR = 0.03

/** The rule itself, for the checks: an albedo's largest channel, as the shader leaves it. */
export function governed(m: number) {
  if (m <= KNEE) return m
  return KNEE + (CEILING - KNEE) * (1 - Math.exp(-(m - KNEE) / (CEILING - KNEE)))
}

let done = false
/** Patch three's shared shader once (before any material is first drawn); debug: show the albedo instead of the light. */
export function governAlbedo(debug = false) {
  if (done) return
  done = true
  const k = KNEE.toFixed(3), w = (CEILING - KNEE).toFixed(3), f = FLOOR.toFixed(3)
  ShaderChunk.lights_physical_fragment = /* glsl */ `
    vec3 walkAlbedo0 = diffuseColor.rgb;
    {
      float m = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
      if (m > ${k}) {
        float g = ${k} + ${w} * (1.0 - exp(-(m - ${k}) / ${w}));
        diffuseColor.rgb = mix(diffuseColor.rgb * (g / m), diffuseColor.rgb, metalnessFactor);
      }
      float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      if (l < ${f}) diffuseColor.rgb = mix(diffuseColor.rgb, max(diffuseColor.rgb * (${f} / max(l, 0.006)), vec3(0.012)), 1.0 - metalnessFactor);
    }
  ` + ShaderChunk.lights_physical_fragment
  if (debug) {
    ShaderChunk.opaque_fragment = ShaderChunk.opaque_fragment.replace(
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
      /* glsl */ `{
        float m0 = max(walkAlbedo0.r, max(walkAlbedo0.g, walkAlbedo0.b));
        float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 dbg = vec3(l);
        if (m0 > ${k}) dbg = mix(dbg, vec3(1.0, 0.0, 1.0), clamp((m0 - ${k}) / (1.0 - ${k}), 0.25, 1.0));
        float l0 = dot(walkAlbedo0, vec3(0.2126, 0.7152, 0.0722));
        if (l0 < ${f} - 0.008) dbg = mix(dbg, vec3(0.0, 0.2, 1.0), 0.75);
        gl_FragColor = vec4(dbg, 1.0);
      }`,
    )
  }
}
