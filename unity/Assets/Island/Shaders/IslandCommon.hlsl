// What the island's shaders share: noise, and one way of lighting.
#ifndef ISLAND_COMMON
#define ISLAND_COMMON

// The sky's light from above and the ground's from below (IslandBuild sets them).
float4 _IslandSky;
float4 _IslandGround;

// How the island is being lit (IslandBuild.Dome). 0: all at once, the sun
// and a flat sky (a quick look). 1: the sun alone, with the light the sunlit
// ground throws back up (_IslandBounce). 2: one patch of the sky, as the main
// light: its direction, and its colour times its share of the sky, with its
// shadow; many such passes added up are the sky's light, shut out wherever
// something stands between a point and that patch of sky.
float _IslandPass;
float4 _IslandBounce;
// What lights itself (glass, the water) comes once over all the sun's samples: each carries this share of it.
float _IslandSelf;

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

bool islandSkyPass() { return _IslandPass > 1.5; }
bool islandSunPass() { return _IslandPass > 0.5 && _IslandPass < 1.5; }

// The light thrown up by the ground, on a surface facing down or sideways.
float3 islandBounce(float3 n) { return _IslandBounce.rgb * saturate(0.5 - n.y * 0.5); }

// The sun, with its shadow, and the sky: a colour lit at a world point with a
// normal. `ao` is how shut in the point is at a scale finer than any shadow
// (a corner, a crease): it dims what the passes cannot see.
float3 islandLight(float3 albedo, float3 n, float3 ws, float ao)
{
    Light sun = GetMainLight(TransformWorldToShadowCoord(ws));
    float ndl = saturate(dot(n, sun.direction));
    if (islandSkyPass()) return albedo * sun.color * ndl * sun.shadowAttenuation * lerp(0.55, 1, ao);
    if (islandSunPass()) return albedo * (sun.color * ndl * sun.shadowAttenuation + islandBounce(n) * ao);
    float3 sky = lerp(_IslandGround.rgb, _IslandSky.rgb, n.y * 0.5 + 0.5) * ao;
    return albedo * (sun.color * ndl * sun.shadowAttenuation + sky);
}

// The tone curve the lit passes end with (IslandBuild.Knee): straight up to
// a knee, then rolling off towards white. A colour that must come out exactly
// (the sea, which meets the site's own) is put through its inverse first.
static const float IslandKnee = 0.8;
float3 islandUnknee(float3 y)
{
    float3 t = saturate((y - IslandKnee) / (1 - IslandKnee));
    float3 x = IslandKnee - (1 - IslandKnee) * log(max(1 - t, 1e-3));
    return y < IslandKnee ? y : x;
}

#endif
