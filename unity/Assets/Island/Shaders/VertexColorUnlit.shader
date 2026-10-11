// Flat vertex colour, no light: for the registration render, where each
// tile's top is painted with its own tile number (IslandBuild.Registration).
Shader "Island/VertexColorUnlit"
{
    SubShader
    {
        Tags { "RenderType" = "Opaque" "RenderPipeline" = "UniversalPipeline" }
        Pass
        {
            Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            struct A { float4 pos : POSITION; float4 col : COLOR; };
            struct V { float4 pos : SV_POSITION; float4 col : COLOR; };
            V vert(A a) { V v; v.pos = TransformObjectToHClip(a.pos.xyz); v.col = a.col; return v; }
            float4 frag(V v) : SV_Target { return v.col; }
            ENDHLSL
        }
    }
}
