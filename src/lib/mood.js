// Stat clamping and mood derivation.

export const clamp = (v) => Math.max(0, Math.min(100, v));

export const cl = (v, lo) => Math.max(lo == null ? 0 : lo, Math.min(100, v));

export function moodOf(s) {
  if (s.energy < 22) return { label: "sleepy", color: "#8FA3B0" };
  if (s.fullness < 22) return { label: "hungry", color: "#D9B26A" };
  if (s.happiness < 28) return { label: "a bit blue", color: "#9B7B8E" };
  if (s.fullness > 65 && s.happiness > 65 && s.energy > 55)
    return { label: "happy", color: "#93A285" };
  return { label: "content", color: "#C2876B" };
}
