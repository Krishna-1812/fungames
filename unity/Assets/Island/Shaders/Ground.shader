// The island's ground: its colour from the colour map (Terrain3D.AlbedoMap,
// laid over the world from above), its detail from photographs (Photos: grass,
// sand, rock, roads, paving, mud), lit by the sun with soft shadows and by the
// sky, darker where the sky is shut out (the vertex colour's red,
// Terrain3D.Occlusion).
//
// The photos are warm and the island is cool, so each gives only how it
// varies from its own average colour (_PhotoMean), mostly in brightness:
// the colour stays the colour map's. Which photo goes where is in the splat
// maps (Terrain3D: layers 0-3 in _SplatA, 4-7 in _SplatB). Each is sampled
// twice, turned and shifted, and the two mixed in patches, so its repeats
// don't show; cliff faces take the cliff photo from the side.
Shader "Island/Ground"
{
    Properties
    {
        _Albedo ("Colour map", 2D) = "white" {}
        _SplatA ("Layers 0-3", 2D) = "black" {}
        _SplatB ("Layers 4-7", 2D) = "black" {}
        _Photo ("Photos", 2DArray) = "" {}
        _PhotoN ("Photos' normals", 2DArray) = "" {}
        _Map ("Map: origin x, z; size x, z", Vector) = (0, 0, 1, 1)
    }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            HLSLPROGRAM
            #pragma target 4.5
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "IslandCommon.hlsl"

            TEXTURE2D(_Albedo); SAMPLER(sampler_Albedo);
            TEXTURE2D(_SplatA); SAMPLER(sampler_SplatA);
            TEXTURE2D(_SplatB);
            TEXTURE2D_ARRAY(_Photo); SAMPLER(sampler_Photo);
            TEXTURE2D_ARRAY(_PhotoN); SAMPLER(sampler_PhotoN);
            float4 _PhotoMean[16];
            CBUFFER_START(UnityPerMaterial)
                float4 _Map;
                float4 _Albedo_ST;
            CBUFFER_END

            // How long one repeat of each photo is, in tiles (Photos.Layers' order).
            static const float Rep[10] = { 2.5, 3.0, 2.0, 4.0, 3.0, 0.55, 0.5, 0.8, 1.1, 1.2 };
            static const float2x2 Turn = float2x2(0.8, -0.6, 0.6, 0.8);
            // How strongly each one's detail shows (over 1, more than the photo has).
            static const float Strength[10] = { 1.15, 0.85, 0.9, 1.2, 1.3, 0.9, 1.0, 1.1, 1.05, 1.25 };
            // The sea's surface, in world height (IslandBuild.Scene).
            float _IslandSea;

            // The cells' edges at a point: Worley noise's second distance less its first.
            float Edges(float2 p)
            {
                float2 i = floor(p), f = frac(p);
                float d1 = 8, d2 = 8;
                [unroll] for (int y = -1; y <= 1; y++)
                [unroll] for (int x = -1; x <= 1; x++)
                {
                    float2 o = float2(x, y);
                    float2 r = o + float2(hash21(i + o), hash21(i + o + 17.3)) - f;
                    float dd = dot(r, r);
                    if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
                }
                return sqrt(d2) - sqrt(d1);
            }

            // Sunlight focused by the ripples on the sea floor: bright threads, two layers crossed.
            float Caustics(float2 p)
            {
                float2 warp = float2(vnoise(p * 2.3), vnoise(p * 2.3 + 9.1)) * 0.8;
                float a = Edges(p * 7.5 + warp);
                float b = Edges(mul(Turn, p) * 9.7 + 5.7 + warp * 1.3);
                return pow(saturate(1 - a * 2.6), 4) * 0.6 + pow(saturate(1 - b * 2.6), 4) * 0.4;
            }

            struct A { float4 pos : POSITION; float3 n : NORMAL; float4 c : COLOR; };
            struct V { float4 pos : SV_POSITION; float3 ws : TEXCOORD0; float3 n : TEXCOORD1; float4 c : COLOR; };

            V vert(A a)
            {
                V o;
                o.ws = TransformObjectToWorld(a.pos.xyz);
                o.pos = TransformWorldToHClip(o.ws);
                o.n = TransformObjectToWorldNormal(a.n);
                o.c = a.c;
                return o;
            }

            // One photo at a point on a plane: its colour over its average, and its normal's tilt (in the plane's u, v).
            void Photo(int k, float2 p, float mix, out float3 detail, out float2 tilt)
            {
                float2 uv = p / Rep[k];
                float2 uv2 = mul(Turn, uv) * 1.13 + float2(0.37, 0.71);
                float3 c = lerp(SAMPLE_TEXTURE2D_ARRAY(_Photo, sampler_Photo, uv, k).rgb, SAMPLE_TEXTURE2D_ARRAY(_Photo, sampler_Photo, uv2, k).rgb, mix);
                float2 n1 = SAMPLE_TEXTURE2D_ARRAY(_PhotoN, sampler_PhotoN, uv, k).rg * 2 - 1;
                float2 n2 = mul(transpose(Turn), SAMPLE_TEXTURE2D_ARRAY(_PhotoN, sampler_PhotoN, uv2, k).rg * 2 - 1);
                float3 d = c / max(_PhotoMean[k].rgb, 0.01);
                // Mostly its light and shade; a little of its own colour (moss on rock, stones in the mud).
                float l = dot(d, float3(0.3, 0.59, 0.11));
                d = lerp(l.xxx, d, 0.3);
                detail = clamp(exp(log(max(d, 0.05)) * Strength[k]), 0.25, 2.4);
                tilt = lerp(n1, n2, mix) * Strength[k];
            }

            half4 frag(V i) : SV_Target
            {
                float2 uv = (i.ws.xz - _Map.xy) / _Map.zw;
                float3 alb = SAMPLE_TEXTURE2D(_Albedo, sampler_Albedo, uv).rgb;
                float4 sa = SAMPLE_TEXTURE2D(_SplatA, sampler_SplatA, uv);
                float4 sb = SAMPLE_TEXTURE2D(_SplatB, sampler_SplatA, uv);
                float3 N = normalize(i.n);
                float2 p = i.ws.xz;

                // Where the two turned copies of each photo take over from each other, in patches.
                float mix = smoothstep(0.38, 0.62, vnoise(p * 0.45) * 0.7 + vnoise(p * 1.7) * 0.3);
                // Grass: two photos in patches, a meadow and a rougher ground.
                float rough = smoothstep(0.5, 0.75, vnoise(p * 0.3 + 11.3) * 0.75 + vnoise(p * 2.1) * 0.25);
                // Rock: seen three ways, as the face turns: the rocks photo from above, the cliff photo from the sides.
                float3 b3 = pow(abs(N), 6); b3 /= b3.x + b3.y + b3.z;

                // A cliff face's own colour: the colour map is laid from above, so on a face it would smear
                // down it; the face takes rock in strata instead, the same at the same height all round.
                float faceness = sa.a * smoothstep(0.35, 0.75, 1 - N.y);
                if (faceness > 0)
                {
                    float y = i.ws.y + (vnoise(p * 2.2) - 0.5) * 0.12;
                    float band = sin(y * 14.0) * 0.5 + 0.5;
                    float fine = vnoise(float2(dot(p, float2(0.7, 0.7)) * 3.0, y * 40.0));
                    float3 lo = SRGBToLinear(float3(0.40, 0.385, 0.36)), hi = SRGBToLinear(float3(0.68, 0.645, 0.585));
                    float3 strata = lerp(lo, hi, saturate(band * 0.7 + fine * 0.3));
                    alb = lerp(alb, strata, faceness);
                }

                float w[10] = { sa.r * (1 - rough), sa.g, sa.b, sa.a * b3.y, sb.r, sb.g, sb.b, sb.a, sa.r * rough, 0 };
                float cliff = sa.a * (1 - b3.y);

                float3 detail = 0; float3 bend = 0; float sum = 0;
                [unroll] for (int k = 0; k < 9; k++)
                {
                    if (w[k] > 0.003)
                    {
                        float3 d; float2 t;
                        Photo(k, p, mix, d, t);
                        detail += w[k] * d; bend += w[k] * float3(t.x, 0, t.y); sum += w[k];
                    }
                }
                if (cliff > 0.003)
                {
                    // From the side, on whichever of the two upright planes the face is nearer.
                    float2 b = b3.xz / max(b3.x + b3.z, 1e-4);
                    float3 dx, dz; float2 tx, tz;
                    Photo(9, i.ws.zy, mix, dx, tx);
                    Photo(9, i.ws.xy, mix, dz, tz);
                    detail += cliff * (dx * b.x + dz * b.y);
                    bend += cliff * (float3(0, tx.y, tx.x) * b.x + float3(tz.x, tz.y, 0) * b.y);
                    sum += cliff;
                }
                // Water (no photo): as the colour map has it.
                detail += saturate(1 - sum);

                alb *= detail;
                // Under the sea: wet and darker at once, and the water taking the red out of it first, then the
                // green, the deeper it lies; faint caustics in the shallows, gone by the shelf's edge.
                float under = _IslandSea - i.ws.y;
                if (under > 0)
                {
                    alb *= lerp(1, 0.66, smoothstep(0, 0.012, under)) * exp(-under * float3(5, 1.7, 1));
                    float fade = smoothstep(0.0, 0.05, under) * (1 - smoothstep(0.1, 0.65, under));
                    alb *= 1 + Caustics(p * 0.6) * 0.25 * fade;
                }
                // Just above the water: a band of wet sand, darker, drying as it rises.
                else alb *= lerp(0.76, 1, smoothstep(0, 0.03, -under));
                // Fine bumps where there is no photo, so the flat still catches the light unevenly.
                float2 q = p * 120;
                float bx = vnoise(q + float2(0.5, 0)) - vnoise(q - float2(0.5, 0));
                float bz = vnoise(q + float2(0, 0.5)) - vnoise(q - float2(0, 0.5));
                bend += float3(-bx, 0, -bz) * 0.35 * saturate(1 - sum) * (under > 0 ? 0 : 1);
                float3 n = normalize(N + bend * 0.9);
                // Under a building: lit as the open ground round it is, a little darker (it is never seen but as the building lifts).
                if (!islandNightPass() && islandUnderFoot(i.ws)) return half4(islandLightOpen(alb * 0.85, n, i.ws, i.c.r), 1);
                return half4(islandLight(alb, n, i.ws, i.c.r), 1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
