// The buildings (Buildings.cs): every surface a material, its pattern drawn
// here at its real size (TEXCOORD0 is in world units along the surface: u
// across, v up a wall or up a roof's slope), on the colour the site gives it
// (the vertex colour, in linear light; its alpha how shut in the point is).
// TEXCOORD1.x says which material (TEXCOORD1.y, 0..1, where in its photograph
// the face starts):
//   0 plaster   1 brick   2 roof tiles   3 slate   4 timber boards
//   5 metal     6 glass   7 concrete     8 paint   9 cloth
//  11 printed artwork (Prints.cs): uv is where on the prints' sheet
//  10 a window's pane: uv runs 0..1 across it and up it; TEXCOORD1.y over 2 says
//     whether its room is lit at night, and in which light (Night.PaneLight)
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
            struct V { float4 pos : SV_POSITION; float3 ws : TEXCOORD0; float3 n : TEXCOORD1; float4 tan : TEXCOORD2; float4 c : COLOR; float2 uv : TEXCOORD3; float2 mat : TEXCOORD4; };

            V vert(A a)
            {
                V o;
                o.ws = TransformObjectToWorld(a.pos.xyz);
                o.pos = TransformWorldToHClip(o.ws);
                o.n = TransformObjectToWorldNormal(a.n);
                o.tan = float4(TransformObjectToWorldDir(a.tan.xyz), a.tan.w);
                o.c = a.c; o.uv = a.uv; o.mat = a.mat;
                return o;
            }

            // The wall photographs (Photos.Walls, Buildings.NewMat): colour and GL normal; each one's average colour; how often each repeats in a unit.
            TEXTURE2D_ARRAY(_WallColour); SAMPLER(sampler_WallColour);
            TEXTURE2D_ARRAY(_WallNormal); SAMPLER(sampler_WallNormal);
            float4 _WallMean[16];
            // The prints' sheet (Prints.cs).
            TEXTURE2D(_Prints); SAMPLER(sampler_Prints);
            // The light in a lit room at night, by kind (Night.Rooms), linear.
            float4 _IslandRooms[4];
            float _WallRep[16];

            // A photograph's detail, without its colour: how much lighter or darker than its average each point is
            // (strength sets the contrast, chroma how much of the photo's own colour variation comes too); and its tilt.
            float3 Photo(int L, float2 uv, float seed, float strength, float chroma, inout float2 bump)
            {
                float2 p = uv * _WallRep[L] + float2(seed, frac(seed * 7.31)) * 4;
                float3 col = SAMPLE_TEXTURE2D_ARRAY(_WallColour, sampler_WallColour, p, L).rgb;
                float3 mean = _WallMean[L].rgb;
                const float3 w = float3(0.2126, 0.7152, 0.0722);
                float3 d = lerp(dot(col, w) / max(dot(mean, w), 1e-3), col / max(mean, 1e-3), chroma);
                d = exp(log(max(d, 0.03)) * strength);
                float3 t = SAMPLE_TEXTURE2D_ARRAY(_WallNormal, sampler_WallNormal, p, L).xyz * 2 - 1;
                bump += t.xy / max(t.z, 0.35) * 1.6;
                return d;
            }

            float fbm(float2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.07 + 3.1) * 0.3 + vnoise(p * 4.3 + 7.7) * 0.2; }

            half4 frag(V i, bool front : SV_IsFrontFace) : SV_Target
            {
                int m = (int)round(i.mat.x);
                int litCode = (int)floor(i.mat.y * 0.5);
                float seed = i.mat.y - litCode * 2;
                float2 uv = i.uv;
                float3 alb = i.c.rgb;
                // Turned to face the camera: a two-sided surface is seen from the side it faces. (Not SV_IsFrontFace, which a
                // render into a texture on Direct3D turns inside out.)
                float3 view = GetWorldSpaceNormalizeViewDir(i.ws);
                float3 N = normalize(i.n); if (dot(N, view) < 0) N = -N;
                // A tangent that came out zero (a degenerate face) would make every light NaN: any direction across the face will do.
                float3 T0 = i.tan.xyz; if (dot(T0, T0) < 1e-10) T0 = cross(N, abs(N.y) < 0.9 ? float3(0, 1, 0) : float3(1, 0, 0));
                float3 T = normalize(T0), B = normalize(cross(N, T)) * i.tan.w;
                float2 bump = 0;     // the surface's tilt, along u and v
                float spec = 0, rough = 40;

                if (m == 0)
                {
                    // Plaster: pale walls in clean render, the rest in old painted plaster; a little darker at the foot.
                    float pale = smoothstep(0.35, 0.6, dot(alb, float3(0.2126, 0.7152, 0.0722)));
                    float2 b0 = 0, b1 = 0;
                    float3 d = lerp(Photo(0, uv, seed, 0.3, 0.05, b0), Photo(1, uv, seed, 0.35, 0.05, b1), pale);
                    bump = lerp(b0, b1, pale) * 0.3;
                    alb *= d * (0.97 + 0.05 * (fbm(uv * 9) - 0.5));
                    alb *= lerp(0.9, 1, saturate(uv.y * 8));
                }
                else if (m == 1)
                {
                    // Brick: pale bricks painted (the old town), the rest bare.
                    float pale = smoothstep(0.3, 0.5, dot(alb, float3(0.2126, 0.7152, 0.0722)));
                    float2 b0 = 0, b1 = 0;
                    float3 d = lerp(Photo(3, uv, seed, 1.0, 0.35, b0), Photo(2, uv, seed, 0.9, 0.2, b1), pale);
                    bump = lerp(b0, b1, pale) * 0.8;
                    alb *= d;
                }
                else if (m == 2 || m == 3)
                {
                    // Roof tiles (2) or slates (3), the photo's courses running across the slope; weathered in patches.
                    alb *= Photo(m == 2 ? 4 : 5, uv, seed, 1.15, 0.25, bump);
                    alb = lerp(alb, alb * float3(0.86, 0.95, 0.88), smoothstep(0.65, 0.9, fbm(uv * 6)) * 0.35);
                    spec = m == 3 ? 0.15 : 0.04; rough = 30;
                }
                else if (m == 4)
                {
                    // Timber boards: the photo turned so the boards lie across the wall.
                    float2 b = 0;
                    alb *= Photo(6, float2(uv.y, uv.x), seed, 1.0, 0.2, b);
                    bump = float2(b.y, b.x);
                }
                else if (m == 5)
                {
                    // Metal: corrugated sheet on walls, panels on roofs and domes; a soft sheen.
                    float roof = smoothstep(0.35, 0.6, abs(N.y));
                    float2 b0 = 0, b1 = 0;
                    alb *= lerp(Photo(7, uv, seed, 0.6, 0.05, b0), Photo(8, uv, seed, 0.45, 0.05, b1), roof);
                    bump = lerp(b0, b1, roof) * 0.7;
                    spec = 0.6; rough = 60;
                }
                else if (m == 10)
                {
                    // A window: the room behind it (dark, lighter low down where the floor takes the daylight, some rooms
                    // brighter than others), curtains drawn to the sides or a blind part way down, and over it all the
                    // sky reflected, shaded under the reveal's head; the pane's own tint; a glint of sun.
                    if (islandSkyPass()) return half4(0, 0, 0, 1);
                    float2 f = saturate(uv);
                    float h1 = hash21(float2(seed * 91.7, 3.1)), h2 = hash21(float2(seed * 13.3, 7.7)), h3 = hash21(float2(seed * 5.1, 1.9));
                    float3 room = float3(0.022, 0.026, 0.034) * (1 + 0.8 * (1 - f.y)) * lerp(0.6, 2.0, h3);
                    float3 fabrics[4] = { float3(0.78, 0.8, 0.84), float3(0.52, 0.58, 0.7), float3(0.66, 0.68, 0.66), float3(0.45, 0.42, 0.55) };
                    float3 fabric = fabrics[(int)floor(h2 * 3.99)];
                    if (islandNightPass())
                    {
                        // At night a lit room glows: brightest round its ceiling light, the far wall
                        // fading down to the furniture's dark line; drawn curtains glow through, a blind's slats
                        // let it out in stripes. A dark room shows only what the lamps outside throw in it.
                        float3 core; float3 e = islandLamps(N, i.ws, core);
                        if (litCode < 1) return half4(e * 0.03 + core, 1);
                        float3 light = _IslandRooms[min(litCode - 1, 3)].rgb;
                        float lamp = exp(-((f.x - lerp(0.35, 0.65, h2)) * (f.x - lerp(0.35, 0.65, h2)) * 5 + (f.y - 0.95) * (f.y - 0.95) * 3));
                        float3 room = light * (0.32 + 0.68 * lamp) * lerp(0.75, 1.25, h3);
                        room *= lerp(0.55, 1, smoothstep(0.12, 0.3, f.y + 0.06 * sin(f.x * 9 + h1 * 20)));
                        if (h1 < 0.5)
                        {
                            float cw = lerp(0.14, 0.32, h2), side = min(f.x, 1 - f.x);
                            float k = smoothstep(cw, cw - 0.03, side);
                            float fold = 0.7 + 0.3 * sin(f.x * 70 + h3 * 6);
                            room = lerp(room, light * lerp(float3(1, 1, 1), fabric, 0.6) * 0.62 * fold, k);
                        }
                        else if (h1 < 0.72)
                        {
                            float drop = lerp(0.25, 0.7, h2), slat = 0.55 + 0.45 * step(0.5, frac(f.y * 22));
                            room = lerp(room, light * lerp(float3(1, 1, 1), fabric, 0.5) * 0.5 * slat, step(1 - drop, f.y));
                        }
                        return half4(room + e * 0.03 + core, 1);
                    }
                    if (h1 < 0.5)
                    {
                        float cw = lerp(0.14, 0.32, h2), side = min(f.x, 1 - f.x);
                        float k = smoothstep(cw, cw - 0.03, side);
                        float fold = 0.78 + 0.22 * sin(f.x * 70 + h3 * 6);
                        room = lerp(room, fabric * 0.26 * fold * lerp(0.8, 1.05, f.y), k);
                    }
                    else if (h1 < 0.72)
                    {
                        float drop = lerp(0.25, 0.7, h2), slat = 0.82 + 0.18 * step(0.5, frac(f.y * 22));
                        room = lerp(room, fabric * 0.3 * slat, step(1 - drop, f.y));
                    }
                    float3 skyR = lerp(float3(0.5, 0.58, 0.7), float3(0.26, 0.36, 0.54), saturate(f.y * 0.7 + (h2 - 0.5) * 0.5));
                    float refl = (0.32 + (h3 - 0.5) * 0.16) * lerp(1, 0.45, smoothstep(0.7, 1.0, f.y));
                    float3 col = lerp(room, skyR, refl) * lerp(float3(1, 1, 1), saturate(i.c.rgb * 1.6), 0.12);
                    Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                    float3 hh = normalize(sun.direction + view);
                    col += pow(saturate(dot(N, hh)), 400) * 2.5 * sun.shadowAttenuation * sun.color;
                    return half4(col * (islandSunPass() ? _IslandSelf : 1), 1);
                }
                else if (m == 6)
                {
                    // Glass: the sky in it, brighter towards the top, darker inside; a sharp glint of sun.
                    float3 sky = float3(0.55, 0.68, 0.82), deep = float3(0.07, 0.1, 0.14);
                    float up = saturate(frac(uv.y / 0.25) * 0.4 + 0.5 + N.y * 0.3);
                    alb = lerp(deep, lerp(deep, sky, 0.55), up) * lerp(float3(1, 1, 1), i.c.rgb * 2, 0.25);
                    float fres = pow(1 - saturate(dot(N, view)), 3);
                    alb += sky * fres * 0.4;
                    // The sky in it is its own light: in the lit passes it comes with the sun's, once.
                    if (islandSkyPass()) return half4(0, 0, 0, 1);
                    if (islandNightPass()) { float3 core; float3 e = islandLamps(N, i.ws, core); return half4(alb * e * 0.5 + core, 1); }
                    Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                    float3 h = normalize(sun.direction + view);
                    float3 col = alb * (0.55 + 0.45 * sun.shadowAttenuation) + pow(saturate(dot(N, h)), 300) * 3 * sun.shadowAttenuation;
                    return half4(col * (islandSunPass() ? _IslandSelf : 1), 1);
                }
                else if (m == 11)
                {
                    // A print: the artwork's own colours (in the sheet, sRGB, read as light), its cut-out edge; a faint sheen of ink and paper.
                    float4 t = SAMPLE_TEXTURE2D(_Prints, sampler_Prints, uv);
                    clip(t.a - 0.5);
                    alb = t.rgb * 0.94;
                    spec = 0.05; rough = 20;
                }
                else if (m == 7)
                {
                    // Concrete or stone.
                    alb *= Photo(9, uv, seed, 0.5, 0.1, bump);
                    bump *= 0.6;
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
                // Cloth is thin: a sail or an awning with the sun behind it glows, a little less than its sunny side would.
                if (m == 9)
                {
                    Light lc = GetMainLight();
                    if (dot(n, lc.direction) < 0) { n = -n; alb *= 0.82; }
                }
                float3 col = islandLight(alb, n, i.ws, i.c.a);
                // Light thrown back onto a wall by the bright ground and the sky in front of it: a wall in the shade is still well lit by day.
                // (The lit passes find that for themselves.)
                float wall = 1 - abs(n.y);
                if (_IslandPass < 0.5) col += alb * (float3(0.2, 0.21, 0.2) * wall + float3(0.1, 0.12, 0.15)) * i.c.a;
                if (spec > 0 && !islandSkyPass() && !islandNightPass())
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
