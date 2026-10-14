// Colours are sRGB, as Unity takes a material's colours, whatever its colour space.
// The sea: clear over the sand by the shore, turquoise over the shelf, deep
// blue further out (the depth map, Terrain3D.DepthMap), with a line of foam
// where it meets the beach and the sun glancing off small ripples.
Shader "Island/Water"
{
    Properties
    {
        _Depth ("Depth map", 2D) = "white" {}
        _Map ("Map: origin x, z; size x, z", Vector) = (0, 0, 1, 1)
        _Shallow ("Shallow", Color) = (0.56, 0.93, 0.88, 1)
        _Mid ("Over the shelf", Color) = (0.13, 0.66, 0.74, 1)
        _Deep ("Deep", Color) = (0.06, 0.40, 0.66, 1)
        _Abyss ("Far out", Color) = (0.035, 0.27, 0.52, 1)
    }
    SubShader
    {
        Tags { "RenderType" = "Transparent" "Queue" = "Transparent" "RenderPipeline" = "UniversalPipeline" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "IslandCommon.hlsl"

            TEXTURE2D(_Depth); SAMPLER(sampler_Depth);
            // The rocks standing in the sea (IslandBuild.Scene): world x, z, and radius at the waterline.
            float4 _Rocks[48];
            float _RockCount;
            CBUFFER_START(UnityPerMaterial)
                float4 _Map;
                float4 _Depth_ST;
                float4 _Shallow, _Mid, _Deep, _Abyss;
            CBUFFER_END

            struct A { float4 pos : POSITION; };
            struct V { float4 pos : SV_POSITION; float3 ws : TEXCOORD0; };

            V vert(A a)
            {
                V o;
                o.ws = TransformObjectToWorld(a.pos.xyz);
                o.pos = TransformWorldToHClip(o.ws);
                return o;
            }

            half4 frag(V i) : SV_Target
            {
                float2 uv = (i.ws.xz - _Map.xy) / _Map.zw;
                bool inside = all(uv > 0) && all(uv < 1);
                float d = inside ? SAMPLE_TEXTURE2D(_Depth, sampler_Depth, uv).r : 1;
                // Ripples: a normal from two scales of noise.
                float2 q = i.ws.xz * 9;
                float n1 = vnoise(q) + 0.5 * vnoise(q * 2.7 + 13.1);
                float bx = (vnoise(q + float2(0.3, 0)) - vnoise(q - float2(0.3, 0)));
                float bz = (vnoise(q + float2(0, 0.3)) - vnoise(q - float2(0, 0.3)));
                // The swell under them: long, low waves running in from the open sea.
                float2 sq = i.ws.xz * 1.6;
                float sw = vnoise(sq + float2(0, 0)) ;
                float sx = vnoise(sq + float2(0.25, 0)) - vnoise(sq - float2(0.25, 0));
                float sz = vnoise(sq + float2(0, 0.25)) - vnoise(sq - float2(0, 0.25));
                float3 n = normalize(float3(-bx * 0.16 - sx * 0.3, 1, -bz * 0.16 - sz * 0.3));

                float t1 = smoothstep(0.0, 0.2, d), t2 = smoothstep(0.25, 0.85, d);
                float3 col = lerp(lerp(_Shallow.rgb, _Mid.rgb, t1), _Deep.rgb, t2);
                // Further out still, deeper; and never one flat colour: broad patches lighter and darker, as
                // the sea is under a sky with weather in it.
                // (By distance from the island's middle, so it deepens smoothly, with no edge where the depth map stops.)
                float2 fromMid = (i.ws.xz - (_Map.xy + _Map.zw * 0.5)) / (_Map.zw * 0.5);
                float far = smoothstep(0.7, 1.3, length(fromMid));
                col = lerp(col, _Abyss.rgb, saturate(far + smoothstep(0.85, 1.0, d) * 0.5));
                float patches = vnoise(i.ws.xz * 0.22 + 3.1) * 0.6 + vnoise(i.ws.xz * 0.6 + 11.7) * 0.4;
                col *= lerp(1.0, lerp(0.86, 1.1, patches), t2);
                col *= 0.97 + 0.06 * sw;
                float alpha = lerp(0.3, 1.0, smoothstep(0.0, 0.45, d));

                float3 view = GetWorldSpaceNormalizeViewDir(i.ws);
                if (islandNightPass())
                {
                    // At night: every light near the water given back by it, broken by the ripples into a streak
                    // (under it on the picture, as a reflection is), and the lamps' light on the foam and the shallows.
                    float3 refl = 0;
                    int cnt = (int)_IslandLampN;
                    [loop] for (int k = 0; k < cnt; k++)
                    {
                        float3 dl = _IslandLampP[k].xyz - i.ws; float dd = dot(dl, dl);
                        if (dd > 12) continue;
                        float3 l = dl * rsqrt(dd);
                        float3 hh = normalize(l + view);
                        float s1 = pow(saturate(dot(n, hh)), 90), s2 = pow(saturate(dot(n, hh)), 30) * 0.015;
                        float kind = _IslandLampD[k].w;
                        float boost = kind > 2.5 ? 0.6 : kind < 0.5 ? 1.0 : 3.0;
                        refl += _IslandLampC[k].rgb * boost * (s1 + s2) / (dd + 0.3);
                    }
                    float3 core; float3 e = islandLamps(float3(0, 1, 0), i.ws, core);
                    float foamN = smoothstep(0.035, 0.0, d) * smoothstep(0.35, 0.65, vnoise(i.ws.xz * 26) * 0.7 + n1 * 0.3);
                    float3 glowN = refl * 0.9 + e * lerp(col * 0.4, float3(0.8, 0.85, 0.9), foamN);
                    return half4(glowN, max(alpha, foamN));
                }
                Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                // (The site paints its own sea in the colour this comes out as round the plate's edges: unity-plate.mjs measures it.)
                float3 lit = col * lerp(0.62, 1.0, sun.shadowAttenuation);
                // The sky in it: more of it the flatter the water is seen, and where a wave's back faces up.
                float fres = 0.04 + 0.96 * pow(1 - saturate(dot(n, view)), 5);
                lit = lerp(lit, float3(0.6, 0.76, 0.95), saturate(fres * 0.55) * t2);
                // The sun on the ripples: a hot core and a wider sheen, glittering where the ripples catch it.
                float3 h = normalize(sun.direction + view);
                float nh = saturate(dot(n, h));
                float glint = smoothstep(0.62, 0.9, vnoise(i.ws.xz * 55) * 0.6 + vnoise(i.ws.xz * 23 + 5) * 0.4);
                float spec = (pow(nh, 260) * 1.8 + pow(nh, 40) * 0.06 + glint * pow(nh, 12) * 0.5) * sun.shadowAttenuation * saturate(d * 4);
                lit += spec * sun.color;
                alpha = saturate(alpha + spec);
                // Foam where it meets the sand, broken up; and the lines of surf coming in behind it.
                float breakup = smoothstep(0.35, 0.65, vnoise(i.ws.xz * 26) * 0.7 + n1 * 0.3);
                float foam = smoothstep(0.035, 0.0, d) * breakup;
                [unroll] for (int w = 1; w <= 3; w++)
                {
                    float at = 0.045 * w + (vnoise(i.ws.xz * 1.3 + w * 4.1) - 0.5) * 0.02;
                    float crest = smoothstep(0.009, 0.0, abs(d - at)) * smoothstep(0.3, 0.7, vnoise(i.ws.xz * float2(6, 6) + w * 9.3) * 0.75 + n1 * 0.25);
                    foam = max(foam, crest * (0.85 - 0.22 * w));
                }
                // Wet, darker sand just under the water's edge.
                lit *= lerp(0.9, 1.0, smoothstep(0.0, 0.05, d));
                // Round the rocks: the water churned white against them, and paler where it is shallow over their skirts.
                for (int r = 0; r < 48; r++)
                {
                    if (r >= (int)_RockCount) break;
                    float2 dv = i.ws.xz - _Rocks[r].xy;
                    float wob = vnoise(i.ws.xz * 14 + r * 7) * 0.08 + vnoise(i.ws.xz * 40) * 0.04;
                    float dd = length(dv) / _Rocks[r].z + wob;
                    float ring = smoothstep(1.45, 1.0, dd) * smoothstep(0.35, 0.65, vnoise(i.ws.xz * 30 + r) * 0.7 + n1 * 0.3);
                    foam = max(foam, ring);
                    lit = lerp(lit, float3(0.62, 0.9, 0.9), smoothstep(2.4, 1.0, dd) * 0.35);
                }
                lit = lerp(lit, float3(0.95, 0.97, 1.0), foam);
                alpha = max(alpha, foam * 0.95);
                // The water is its own light (the sky in it): in the lit passes it is added once, with the sun,
                // and put through the knee's inverse, so the grade takes it as a surface in the sun. Over
                // what lies under it, every pass covers the same share.
                if (islandSkyPass()) return half4(0, 0, 0, alpha);
                if (islandSunPass()) lit = islandUnknee(lit) * _IslandSelf;
                return half4(lit, alpha);
            }
            ENDHLSL
        }
    }
}
