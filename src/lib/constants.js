// Palettes, names, and other shared constants for the companion app.

export const DRAW_PALETTE = [
  "#4A4038", "#C2876B", "#C98B86", "#D9B26A",
  "#93A285", "#8FA3B0", "#9B7B8E", "#F1E7D2",
];

export const GEN_PALETTE = [
  "#C2876B", "#C98B86", "#93A285", "#8FA3B0", "#D9B26A", "#9B7B8E",
  "#B0926F", "#A8B49A", "#CDA07E", "#86A89B", "#D7A98C", "#A88FA0",
];

export const FRIEND_NAMES = [
  "Bun", "Tofu", "Sprout", "Pebble", "Momo", "Cloud", "Biscuit", "Yuzu",
  "Fig", "Pico", "Dewi", "Maple", "Plum", "Suki", "Noodle", "Pesto",
];

export const STORE_KEY = "tamagotchi_v1";

// Wrapper style for meadow agents is a STABLE constant so React never
// re-applies it on re-render and clobbers the imperative positioning.
export const AGENT_WRAP = {
  position: "absolute", left: "50%", top: "72%",
  transform: "translate(-50%,-100%)", pointerEvents: "none",
  willChange: "transform,left,top",
};
