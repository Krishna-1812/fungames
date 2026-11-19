/**
 * What Days Since Incident knows before any feed answers: the most recent
 * flare and storm at every level, read from the full records by
 * scripts/build-incident-seed.mjs (HEK's copy of NOAA SWPC's GOES flare list,
 * and GFZ Potsdam's Kp since 1932). Written by that script; not edited by hand.
 */
import type { SourcedEvent } from '../lib/space-weather'

export const SEED_AS_OF = 1795111200000

export const SEED: SourcedEvent[] = [
  {
    "kind": "flare",
    "time": 1795078680000,
    "value": 0.0000032,
    "detail": "Class C3.2 solar flare, from sunspot region 14572, peaking 08:58 UTC",
    "src": "NOAA SWPC via HEK"
  },
  {
    "kind": "flare",
    "time": 1794951540000,
    "value": 0.000017,
    "detail": "Class M1.7 solar flare, from sunspot region 14578, peaking 21:39 UTC",
    "src": "NOAA SWPC via HEK"
  },
  {
    "kind": "flare",
    "time": 1783197660000,
    "value": 0.00013000000000000002,
    "detail": "Class X1.3 solar flare, from sunspot region 14482, peaking 20:41 UTC",
    "src": "NOAA SWPC via HEK"
  },
  {
    "kind": "flare",
    "time": 1769990220000,
    "value": 0.00081,
    "detail": "Class X8.1 solar flare, from sunspot region 14366, peaking 23:57 UTC",
    "src": "NOAA SWPC via HEK"
  },
  {
    "kind": "flare",
    "time": 1126114800000,
    "value": 0.0017000000000000001,
    "detail": "Class X17 solar flare, from sunspot region 10808, peaking 17:40 UTC",
    "src": "NOAA SWPC via HEK"
  },
  {
    "kind": "storm",
    "time": 1794074400000,
    "value": 5,
    "detail": "G1 storm, Kp 5 for the three hours from 18:00 UTC",
    "src": "GFZ Potsdam"
  },
  {
    "kind": "storm",
    "time": 1791655200000,
    "value": 7,
    "detail": "G3 storm, Kp 7 for the three hours from 18:00 UTC",
    "src": "GFZ Potsdam"
  },
  {
    "kind": "storm",
    "time": 1791655200000,
    "value": 7,
    "detail": "G3 storm, Kp 7 for the three hours from 18:00 UTC",
    "src": "GFZ Potsdam"
  },
  {
    "kind": "storm",
    "time": 1768856400000,
    "value": 8.667,
    "detail": "G4 storm, Kp 9- for the three hours from 21:00 UTC",
    "src": "GFZ Potsdam"
  },
  {
    "kind": "storm",
    "time": 1715418000000,
    "value": 9,
    "detail": "G5 storm, Kp 9 for the three hours from 09:00 UTC",
    "src": "GFZ Potsdam"
  }
]
