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
        _Shallow ("Shallow", Color) = (0.651, 0.910, 0.878, 1)
        _Mid ("Over the shelf", Color) = (0.498, 0.816, 0.941, 1)
        _Deep ("Deep", Color) = (0.549, 0.796, 1.0, 1)
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
                float4 _Shallow, _Mid, _Deep;
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
                float3 n = normalize(float3(-bx * 0.25, 1, -bz * 0.25));

                float t1 = smoothstep(0.0, 0.18, d), t2 = smoothstep(0.3, 1.0, d);
                float3 col = lerp(lerp(_Shallow.rgb, _Mid.rgb, t1), _Deep.rgb, t2);
                float alpha = lerp(0.3, 1.0, smoothstep(0.0, 0.45, d));

                Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                float3 view = GetWorldSpaceNormalizeViewDir(i.ws);
                // In the sun, the deep colour is exactly the site's own sea (#8ccbff), so the two meet without a seam.
                float3 lit = col * lerp(0.62, 1.0, sun.shadowAttenuation);
                // The sun on the ripples.
                float3 h = normalize(sun.direction + view);
                float spec = pow(saturate(dot(n, h)), 220) * 1.4 * sun.shadowAttenuation;
                lit += spec * sun.color;
                alpha = saturate(alpha + spec);
                // Foam where it meets the sand, broken up.
                float foam = smoothstep(0.035, 0.0, d) * smoothstep(0.35, 0.65, vnoise(i.ws.xz * 26) * 0.7 + n1 * 0.3);
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
                // and put through the tone curve's inverse so that it comes out as the site's own sea. Over
                // what lies under it, every pass covers the same share.
                if (islandSkyPass()) return half4(0, 0, 0, alpha);
                if (islandSunPass()) lit = islandUnknee(lit) * _IslandSelf;
                return half4(lit, alpha);
            }
            ENDHLSL
        }
    }
}
