// Adds one lit pass into the running total (IslandBuild.Dome): the colour
// added, the coverage (alpha) left as the first pass wrote it.
Shader "Hidden/Island/Accumulate"
{
    Properties { _MainTex ("", 2D) = "black" {} }
    SubShader
    {
        ZTest Always Cull Off ZWrite Off
        Blend One One, Zero One
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            float4 frag(v2f_img i) : SV_Target { return tex2D(_MainTex, i.uv); }
            ENDCG
        }
    }
}
