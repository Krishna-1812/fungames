// The island's ground: its colour from the colour map (Terrain3D.AlbedoMap,
// laid over the world from above), a fine grain and small bumps on top, lit
// by the sun with soft shadows and by the sky, darker where the sky is shut
// out (the vertex colour's red, Terrain3D.Occlusion).
Shader "Island/Ground"
{
    Properties
    {
        _Albedo ("Colour map", 2D) = "white" {}
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
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "IslandCommon.hlsl"

            TEXTURE2D(_Albedo); SAMPLER(sampler_Albedo);
            CBUFFER_START(UnityPerMaterial)
                float4 _Map;
                float4 _Albedo_ST;
            CBUFFER_END

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

            half4 frag(V i) : SV_Target
            {
                float2 uv = (i.ws.xz - _Map.xy) / _Map.zw;
                float4 map = SAMPLE_TEXTURE2D(_Albedo, sampler_Albedo, uv);
                float3 alb = map.rgb;
                float kind = map.a; // 0 water, .25 paving, .5 rock, .75 sand, 1 grass (Terrain3D.Albedo)
                // Grain at two scales, finer than the colour map.
                float g = vnoise(i.ws.xz * 90) * 0.6 + vnoise(i.ws.xz * 260) * 0.4;
                alb *= 0.93 + 0.14 * g;
                // Grass: blades, dark at the root and light at the tip, in tufts.
                float grass = smoothstep(0.85, 1.0, kind);
                float2 gp = i.ws.xz * float2(330, 410);
                float blade = vnoise(gp) * vnoise(gp * 2.3 + 7.1);
                float tuft = vnoise(i.ws.xz * 55);
                alb *= lerp(1, 0.72 + 0.62 * blade + 0.12 * tuft, grass);
                // Sand: a glint here and there; rock: deeper pits.
                float sand = smoothstep(0.6, 0.8, kind) * (1 - grass);
                alb *= lerp(1, 0.9 + 0.2 * step(0.82, vnoise(i.ws.xz * 700)), sand);
                float rock = 1 - abs(kind - 0.5) * 8;
                alb *= lerp(1, 0.75 + 0.45 * vnoise(i.ws.xz * 160), saturate(rock));
                // Small bumps, so a flat field still catches the light unevenly.
                float2 q = i.ws.xz * 120;
                float bx = vnoise(q + float2(0.5, 0)) - vnoise(q - float2(0.5, 0));
                float bz = vnoise(q + float2(0, 0.5)) - vnoise(q - float2(0, 0.5));
                float3 n = normalize(normalize(i.n) + float3(-bx, 0, -bz) * 0.35);
                return half4(islandLight(alb, n, i.ws, i.c.r), 1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
