// Adapted from ascii-sharks; see THIRD_PARTY_NOTICES.md.
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function hash3(x: number, y: number, z: number) {
  let h =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

