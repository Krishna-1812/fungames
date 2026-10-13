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

bool islandSkyPass() { return _IslandPass > 1.5 && _IslandPass < 2.5; }
bool islandSunPass() { return _IslandPass > 0.5 && _IslandPass < 1.5; }
// 3: the night's own lights alone (Night.cs): the street lamps, the lit windows, the bulbs.
bool islandNightPass() { return _IslandPass > 2.5; }

// The night's lights (Night.Upload). P: where (xyz) and how far it reaches (w). C: its colour times its
// strength (rgb), and the radius of its glowing core (w: a lamp's glass, the lighthouse's lantern).
// D: for a window, the way it faces (xyz); w, what it is: 0 a street lamp (shaded above, casting shadows),
// 1 a window, 2 a bulb, 3 the lighthouse (casting shadows).
float _IslandLampN;
float4 _IslandLampP[256];
float4 _IslandLampC[256];
float4 _IslandLampD[256];
// The tallest thing over each point of the island, seen from above (Night.Height): what stands between a lamp and a point.
TEXTURE2D(_IslandHeight); SAMPLER(sampler_IslandHeight);
float4 _IslandHeightMap;   // x0, z0, 1 / size

// How much of the way from a to the light at b is open: marched over the height map, stopping short of
// the light (its own lantern and post are in the map too).
float islandLampShadow(float3 a, float3 b)
{
    float3 d = b - a; float len = length(d);
    float reach = max(len - 0.14, 0);
    float vis = 1;
    [loop] for (int s = 1; s <= 24; s++)
    {
        float3 p = a + d * (reach * s / (24.0 * len));
        float h = SAMPLE_TEXTURE2D_LOD(_IslandHeight, sampler_IslandHeight, (p.xz - _IslandHeightMap.xy) * _IslandHeightMap.z, 0).r;
        vis = min(vis, saturate(1 - (h - p.y) / 0.05));
    }
    return vis;
}

// The light the night's lamps throw on a point with a normal (irradiance), and how brightly the point
// itself glows if it is one of their cores (a lamp's glass).
float3 islandLamps(float3 n, float3 ws, out float3 core)
{
    float3 e = 0; core = 0;
    int cnt = (int)_IslandLampN;
    [loop] for (int k = 0; k < cnt; k++)
    {
        float4 P = _IslandLampP[k];
        float3 d = P.xyz - ws; float dd = dot(d, d);
        if (dd > P.w * P.w) continue;
        float4 C = _IslandLampC[k], D = _IslandLampD[k];
        float dist = sqrt(dd); float3 l = d / max(dist, 1e-4);
        if (C.w > 0) core += C.rgb * 4 * smoothstep(C.w, C.w * 0.5, dist);
        float ndl = saturate(dot(n, l));
        if (ndl <= 0) continue;
        float lobe = 1;
        // A street lamp's shade keeps its light off the sky: most goes down, a little sideways.
        if (D.w < 0.5) lobe = saturate(0.3 + 1.2 * l.y);
        // A window's light goes out of it, not along the wall.
        else if (D.w < 1.5) lobe = saturate(dot(-l, D.xyz));
        if (lobe <= 0) continue;
        float win = saturate(1 - dd / (P.w * P.w)); win *= win;
        float att = win / (dd + 0.03);
        if (D.w < 0.5 || D.w > 2.5) att *= islandLampShadow(ws + n * 0.07, P.xyz);
        e += C.rgb * ndl * lobe * att;
    }
    return e;
}


// The light thrown up by the ground, on a surface facing down or sideways.
float3 islandBounce(float3 n) { return _IslandBounce.rgb * saturate(0.5 - n.y * 0.5); }

// The sun, with its shadow, and the sky: a colour lit at a world point with a
// normal. `ao` is how shut in the point is at a scale finer than any shadow
// (a corner, a crease): it dims what the passes cannot see.
float3 islandLight(float3 albedo, float3 n, float3 ws, float ao)
{
    if (islandNightPass()) { float3 core; float3 e = islandLamps(n, ws, core); return albedo * e * lerp(0.5, 1, ao) + core; }
    Light sun = GetMainLight(TransformWorldToShadowCoord(ws));
    float ndl = saturate(dot(n, sun.direction));
    if (islandSkyPass()) return albedo * sun.color * ndl * sun.shadowAttenuation * lerp(0.55, 1, ao);
    if (islandSunPass()) return albedo * (sun.color * ndl * sun.shadowAttenuation + islandBounce(n) * ao);
    float3 sky = lerp(_IslandGround.rgb, _IslandSky.rgb, n.y * 0.5 + 0.5) * ao;
    return albedo * (sun.color * ndl * sun.shadowAttenuation + sky);
}

// Where the buildings stand on the ground (IslandBuild.Footprints): x0, z0, x1, z1 in the world, a box's
// or a cylinder's (w < 0: the middle and the radius). The ground under one is never seen, but for a moment
// when the building lifts or drops in: it is lit as open ground, not left black in the building's shade.
float _IslandFootN;
float4 _IslandFoot[256];
bool islandUnderFoot(float3 ws)
{
    int cnt = (int)_IslandFootN;
    [loop] for (int k = 0; k < cnt; k++)
    {
        float4 b = _IslandFoot[k];
        if (b.w < 0) { if (distance(ws.xz, b.xy) < b.z - 0.015) return true; }
        else if (ws.x > b.x + 0.015 && ws.x < b.z - 0.015 && ws.z > b.y + 0.015 && ws.z < b.w - 0.015) return true;
    }
    return false;
}

// The same light as islandLight, with nothing standing in its way.
float3 islandLightOpen(float3 albedo, float3 n, float3 ws, float ao)
{
    Light sun = GetMainLight();
    float ndl = saturate(dot(n, sun.direction));
    if (islandSkyPass()) return albedo * sun.color * ndl * lerp(0.55, 1, ao);
    if (islandSunPass()) return albedo * (sun.color * ndl + islandBounce(n) * ao);
    return albedo * (sun.color * ndl + lerp(_IslandGround.rgb, _IslandSky.rgb, n.y * 0.5 + 0.5) * ao);
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
