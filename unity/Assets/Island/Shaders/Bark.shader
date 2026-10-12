// Trunks, branches, cactus skin and rock models: a photo (_BaseMap) whose light
// and shade (over its average, _Mean) lie on the surface's own colour
// (_BaseColor, times the vertex colour's rgb), with its normal map if it has
// one (_Normal, OpenGL, linear), lit by the island's sun and sky; the vertex
// alpha is how shut in the point is.
Shader "Island/Bark"
{
    Properties
    {
        _BaseMap ("Photo", 2D) = "white" {}
        _Normal ("Normal map (GL)", 2D) = "bump" {}
        _BaseColor ("Colour", Color) = (1, 1, 1, 1)
        _Mean ("The photo's average brightness", Float) = 0.3
        _Detail ("How much of the photo shows", Range(0, 2)) = 1
        _Bump ("How strongly the normal map shows", Range(0, 2)) = 1
        _HasNormal ("Has a normal map", Float) = 0
        _Spec ("Shine", Range(0, 1)) = 0
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

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_Normal); SAMPLER(sampler_Normal);
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST;
                float4 _BaseColor;
                float _Mean, _Detail, _Bump, _HasNormal, _Spec;
            CBUFFER_END

            struct A { float4 pos : POSITION; float3 n : NORMAL; float4 tan : TANGENT; float4 c : COLOR; float2 uv : TEXCOORD0; };
            struct V { float4 pos : SV_POSITION; float3 ws : TEXCOORD0; float3 n : TEXCOORD1; float4 tan : TEXCOORD2; float4 c : COLOR; float2 uv : TEXCOORD3; };

            V vert(A a)
            {
                V o;
                o.ws = TransformObjectToWorld(a.pos.xyz);
                o.pos = TransformWorldToHClip(o.ws);
                o.n = TransformObjectToWorldNormal(a.n);
                o.tan = float4(TransformObjectToWorldDir(a.tan.xyz), a.tan.w);
                o.c = a.c; o.uv = TRANSFORM_TEX(a.uv, _BaseMap);
                return o;
            }

            half4 frag(V i) : SV_Target
            {
                float3 t = SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, i.uv).rgb;
                float l = dot(t, float3(0.3, 0.59, 0.11)) / _Mean;
                float3 alb = _BaseColor.rgb * i.c.rgb * clamp(lerp(1, l, _Detail), 0.2, 2.2);
                float3 n = normalize(i.n);
                if (_HasNormal > 0.5)
                {
                    float3 tn = SAMPLE_TEXTURE2D(_Normal, sampler_Normal, i.uv).rgb * 2 - 1;
                    tn.xy *= _Bump;
                    float3 tg = normalize(i.tan.xyz), bt = cross(n, tg) * i.tan.w;
                    n = normalize(tg * tn.x + bt * tn.y + n * max(tn.z, 0.2));
                }
                float3 col = islandLight(alb, n, i.ws, i.c.a);
                if (_Spec > 0 && !islandSkyPass())
                {
                    Light sun = GetMainLight(TransformWorldToShadowCoord(i.ws));
                    float3 h = normalize(sun.direction + GetWorldSpaceNormalizeViewDir(i.ws));
                    col += pow(saturate(dot(n, h)), 40) * _Spec * sun.shadowAttenuation * sun.color;
                }
                return half4(col, 1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
