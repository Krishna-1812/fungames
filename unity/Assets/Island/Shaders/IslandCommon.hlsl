// What the island's shaders share: noise, and one way of lighting.
#ifndef ISLAND_COMMON
#define ISLAND_COMMON

// The sky's light from above and the ground's from below (IslandBuild sets them).
float4 _IslandSky;
float4 _IslandGround;

float hash21(float2 p)
{
    p = frac(p * float2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return frac(p.x * p.y);
}

float vnoise(float2 p)
{
    float2 i = floor(p), f = frac(p);
    f = f * f * (3 - 2 * f);
    return lerp(lerp(hash21(i), hash21(i + float2(1, 0)), f.x), lerp(hash21(i + float2(0, 1)), hash21(i + 1), f.x), f.y);
}

// The sun, with its shadow, and the sky: a colour lit at a world point with a normal, less sky where `ao` is low.
float3 islandLight(float3 albedo, float3 n, float3 ws, float ao)
{
    Light sun = GetMainLight(TransformWorldToShadowCoord(ws));
    float ndl = saturate(dot(n, sun.direction));
    float3 sky = lerp(_IslandGround.rgb, _IslandSky.rgb, n.y * 0.5 + 0.5) * ao;
    return albedo * (sun.color * ndl * sun.shadowAttenuation + sky);
}

#endif
