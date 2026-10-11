// Leaves and needles: cards cut from Poly Haven's photographs (Plants.cs), two-
// sided, their edges by the photo's alpha. Each card's colour is its vertex
// colour (the species' own, varied card by card) times the photo's light and
// shade (the photo over its own average, as the ground takes its detail), so
// any leaf photo can be any tree's. Lit as a crown, not as flat cards: the
// normal leans out from the crown's middle (TEXCOORD1), the sun comes through
// leaves lit from behind, and the vertex alpha says how deep in the crown a
// card is, which the sky reaches less. Shadows: each crown shades itself and
// what is under it (the Lit shadow pass, cut by the same alpha).
Shader "Island/Foliage"
{
    Properties
    {
        _BaseMap ("Leaves (alpha cut)", 2D) = "white" {}
        _BaseColor ("Colour", Color) = (1, 1, 1, 1)
        _Cutoff ("Cut", Range(0, 1)) = 0.45
        _Mean ("The photo's average brightness", Float) = 0.3
        _Round ("How much it is lit as a crown", Range(0, 1)) = 0.6
    }
    SubShader
    {
        Tags { "RenderType" = "TransparentCutout" "RenderPipeline" = "UniversalPipeline" "Queue" = "AlphaTest" }
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

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                float4 _BaseColor;
                float _Cutoff, _Mean, _Round;
            CBUFFER_END

            struct A { float4 pos : POSITION; float3 n : NORMAL; float4 c : COLOR; float2 uv : TEXCOORD0; float3 crown : TEXCOORD1; };
            struct V { float4 pos : SV_POSITION; float3 ws : TEXCOORD0; float3 n : TEXCOORD1; float4 c : COLOR; float2 uv : TEXCOORD2; float3 crown : TEXCOORD3; };

            V vert(A a)
            {
                V o;
                o.ws = TransformObjectToWorld(a.pos.xyz);
                o.pos = TransformWorldToHClip(o.ws);
                o.n = TransformObjectToWorldNormal(a.n);
                o.crown = TransformObjectToWorldNormal(a.crown);
                o.c = a.c; o.uv = a.uv;
                return o;
            }

            half4 frag(V i, bool front : SV_IsFrontFace) : SV_Target
            {
                float4 t = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv);
                clip(t.a - _Cutoff);
                // The photo's light and shade, on the card's own colour.
                float l = dot(t.rgb, float3(0.3, 0.59, 0.11)) / _Mean;
                float3 alb = i.c.rgb * clamp(lerp(1, l, 0.9), 0.3, 1.8);
                float3 view = GetWorldSpaceNormalizeViewDir(i.ws);
                float3 cn = normalize(front ? i.n : -i.n);
                float3 n = normalize(lerp(cn, normalize(i.crown), _Round));
                Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                float ao = i.c.a;
                // Wrapped: a leaf turned a little from the sun still catches some of it.
                float ndl = saturate((dot(n, sun.direction) + 0.35) / 1.35);
                // Through the leaf: bright where the sun is behind it.
                float through = pow(saturate(dot(-view, sun.direction)), 3) * 0.35 + saturate(dot(-cn, sun.direction)) * 0.18;
                float3 sky = lerp(_IslandGround.rgb, _IslandSky.rgb, n.y * 0.5 + 0.5) * lerp(0.35, 1, ao);
                float3 lit = alb * (sun.color * (ndl + through * float3(0.9, 1.0, 0.75)) * sun.shadowAttenuation * lerp(0.6, 1, ao) + sky);
                return half4(lit, 1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
