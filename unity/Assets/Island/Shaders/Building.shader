// The buildings (Buildings.cs): every surface a material, its pattern drawn
// here at its real size (TEXCOORD0 is in world units along the surface: u
// across, v up a wall or up a roof's slope), on the colour the site gives it
// (the vertex colour, in linear light; its alpha how shut in the point is).
// TEXCOORD1.x says which material:
//   0 plaster   1 brick   2 roof tiles   3 slate   4 timber boards
//   5 metal     6 glass   7 concrete     8 paint   9 cloth
Shader "Island/Building"
{
    Properties { }
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" "Queue" = "Geometry" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode" = "UniversalForward" }
            Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "IslandCommon.hlsl"

            struct A { float4 pos : POSITION; float3 n : NORMAL; float4 tan : TANGENT; float4 c : COLOR; float2 uv : TEXCOORD0; float2 mat : TEXCOORD1; };
            struct V { float4 pos : SV_POSITION; float3 ws : TEXCOORD0; float3 n : TEXCOORD1; float4 tan : TEXCOORD2; float4 c : COLOR; float2 uv : TEXCOORD3; float mat : TEXCOORD4; };

            V vert(A a)
            {
                V o;
                o.ws = TransformObjectToWorld(a.pos.xyz);
                o.pos = TransformWorldToHClip(o.ws);
                o.n = TransformObjectToWorldNormal(a.n);
                o.tan = float4(TransformObjectToWorldDir(a.tan.xyz), a.tan.w);
                o.c = a.c; o.uv = a.uv; o.mat = a.mat.x;
                return o;
            }

            float fbm(float2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.07 + 3.1) * 0.3 + vnoise(p * 4.3 + 7.7) * 0.2; }

            // Coursed units (bricks, tiles, slates, boards): which unit, where in it (0..1), offset every other course.
            void Courses(float2 uv, float2 size, out float2 id, out float2 f)
            {
                float row = floor(uv.y / size.y);
                float x = uv.x / size.x + (fmod(abs(row), 2) > 0.5 ? 0.5 : 0);
                id = float2(floor(x), row);
                f = float2(frac(x), frac(uv.y / size.y));
            }

            half4 frag(V i, bool front : SV_IsFrontFace) : SV_Target
            {
                int m = (int)round(i.mat);
                float2 uv = i.uv;
                float3 alb = i.c.rgb;
                float3 N = normalize(front ? i.n : -i.n);
                float3 T = normalize(i.tan.xyz), B = normalize(cross(N, T)) * i.tan.w;
                float2 bump = 0;     // the surface's tilt, along u and v
                float spec = 0, rough = 40;
                float3 view = GetWorldSpaceNormalizeViewDir(i.ws);

                if (m == 0)
                {
                    // Plaster: a fine grain, faint patches, a little darker where rain runs down and at the foot.
                    float g = fbm(uv * 160);
                    alb *= 0.94 + 0.08 * g + 0.05 * (fbm(uv * 9) - 0.5);
                    alb *= lerp(0.9, 1, saturate(uv.y * 8));
                    alb *= 1 - 0.025 * smoothstep(0.7, 1, vnoise(float2(uv.x * 12, uv.y * 1.5)));
                    bump = (float2(vnoise(uv * 300 + 1), vnoise(uv * 300 + 9)) - 0.5) * 0.25;
                }
                else if (m == 1)
                {
                    float2 id, f; Courses(uv, float2(0.05, 0.0175), id, f);
                    float mortar = 1 - step(0.06, f.x) * step(f.x, 0.94) * step(0.12, f.y) * step(f.y, 0.88);
                    float tone = hash21(id) * 0.18 - 0.09;
                    alb = lerp(alb * (1 + tone) * (0.93 + 0.1 * fbm(uv * 200)), lerp(alb, float3(0.75, 0.75, 0.74), 0.6), mortar);
                    bump = mortar * float2(f.x < 0.5 ? 0.6 : -0.6, f.y < 0.5 ? 0.6 : -0.6) * 0.5;
                }
                else if (m == 2 || m == 3)
                {
                    // Roof tiles (2) or slates (3), in courses up the slope: each course's lower edge casts a line of shadow on the one below.
                    float2 size = m == 2 ? float2(0.028, 0.026) : float2(0.032, 0.018);
                    float2 id, f; Courses(uv, size, id, f);
                    float tone = hash21(id + 3.7) * (m == 2 ? 0.22 : 0.3) - (m == 2 ? 0.11 : 0.15);
                    float course = lerp(0.62, 1.04, smoothstep(0.0, 0.35, f.y));
                    float gap = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x);
                    float barrel = m == 2 ? 0.88 + 0.16 * sin(f.x * 3.14159) : 1;
                    alb *= (1 + tone) * course * lerp(0.75, 1, gap) * barrel * (0.94 + 0.1 * fbm(uv * 120));
                    // Moss and weathering along the low courses.
                    alb = lerp(alb, alb * float3(0.86, 0.95, 0.88), smoothstep(0.65, 0.9, fbm(uv * 6)) * 0.4);
                    bump = float2((m == 2 ? cos(f.x * 6.283) * 0.5 : 0), -smoothstep(0.0, 0.25, f.y) + 0.5) * 0.6;
                    spec = m == 3 ? 0.15 : 0.04; rough = 30;
                }
                else if (m == 4)
                {
                    // Boards laid one over another: a shadow under each.
                    float row = uv.y / 0.016;
                    float f = frac(row), id = floor(row);
                    alb *= (0.92 + 0.16 * hash21(float2(id, 1.3))) * lerp(0.7, 1, smoothstep(0, 0.18, f)) * (0.9 + 0.15 * vnoise(float2(uv.x * 40, row * 3)));
                    bump = float2(0, f < 0.18 ? 0.8 : -0.1);
                }
                else if (m == 5)
                {
                    // Metal: standing seams, a soft sheen.
                    float f = frac(uv.x / 0.035);
                    float seam = smoothstep(0.92, 0.96, f) - smoothstep(0.97, 1.0, f);
                    alb *= (0.95 + 0.06 * fbm(uv * 40)) * (1 + seam * 0.25);
                    bump = float2(seam * 1.5, 0);
                    spec = 0.6; rough = 60;
                }
                else if (m == 6)
                {
                    // Glass: the sky in it, brighter towards the top, darker inside; a sharp glint of sun.
                    float3 sky = float3(0.55, 0.68, 0.82), deep = float3(0.07, 0.1, 0.14);
                    float up = saturate(frac(uv.y / 0.25) * 0.4 + 0.5 + N.y * 0.3);
                    alb = lerp(deep, lerp(deep, sky, 0.55), up) * lerp(float3(1, 1, 1), i.c.rgb * 2, 0.25);
                    float fres = pow(1 - saturate(dot(N, view)), 3);
                    alb += sky * fres * 0.4;
                    Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                    float3 h = normalize(sun.direction + view);
                    float3 col = alb * (0.55 + 0.45 * sun.shadowAttenuation) + pow(saturate(dot(N, h)), 300) * 3 * sun.shadowAttenuation;
                    return half4(col, 1);
                }
                else if (m == 7)
                {
                    // Concrete or stone, in large slabs.
                    float2 id, f; Courses(uv, float2(0.16, 0.08), id, f);
                    float joint = 1 - step(0.015, f.x) * step(f.x, 0.985) * step(0.03, f.y) * step(f.y, 0.97);
                    alb *= (0.93 + 0.1 * fbm(uv * 90)) * (1 + (hash21(id) - 0.5) * 0.08) * (1 - joint * 0.18);
                    bump = (float2(vnoise(uv * 220), vnoise(uv * 220 + 5)) - 0.5) * 0.35;
                }
                else if (m == 8)
                {
                    // Paint on wood or metal: smooth, a faint sheen.
                    alb *= 0.97 + 0.04 * fbm(uv * 80);
                    spec = 0.12; rough = 30;
                }
                else
                {
                    // Cloth: a fine weave, soft.
                    alb *= 0.95 + 0.06 * vnoise(uv * 400) + 0.04 * sin(uv.x * 900);
                }

                float3 n = normalize(N + (T * bump.x + B * bump.y) * 0.35);
                float3 col = islandLight(alb, n, i.ws, i.c.a);
                // Light thrown back onto a wall by the bright ground and the sky in front of it: a wall in the shade is still well lit by day.
                float wall = 1 - abs(n.y);
                col += alb * (float3(0.2, 0.21, 0.2) * wall + float3(0.1, 0.12, 0.15)) * i.c.a;
                if (spec > 0)
                {
                    Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                    float3 h = normalize(sun.direction + view);
                    col += pow(saturate(dot(n, h)), rough) * spec * sun.shadowAttenuation * sun.color;
                }
                return half4(col, 1);
            }
            ENDHLSL
        }
        Pass
        {
            Name "ShadowCaster"
            Tags { "LightMode" = "ShadowCaster" }
            Cull Off
            ZWrite On ZTest LEqual ColorMask 0
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection;
            struct A { float4 pos : POSITION; float3 n : NORMAL; };
            float4 vert(A a) : SV_POSITION
            {
                float3 ws = TransformObjectToWorld(a.pos.xyz);
                float3 n = TransformObjectToWorldNormal(a.n);
                float4 p = TransformWorldToHClip(ApplyShadowBias(ws, n, _LightDirection));
                #if UNITY_REVERSED_Z
                    p.z = min(p.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    p.z = max(p.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                return p;
            }
            half4 frag() : SV_Target { return 0; }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
