import { VIDEO_PROXIMITY_RADIUS } from '../characters/OtherPlayer'

/** 0 = out of range, 1 = full strength (quadratic falloff). */
export function proximityStrength(
  distance: number,
  maxRadius: number = VIDEO_PROXIMITY_RADIUS
): number {
  if (distance >= maxRadius) return 0
  const t = 1 - distance / maxRadius
  return t * t
}
