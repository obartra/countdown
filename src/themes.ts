export type ThemeDefinition = {
  key: string;
  background: string;
  text: string;
  accent?: string;
};

export const DEFAULT_THEME_KEY = "midnight";

export const themes: ThemeDefinition[] = [
  {
    key: "midnight",
    background: "#0B1021",
    text: "#F2F5FF",
    accent: "#7DD3FC",
  },
  {
    key: "aurora-neon",
    background: "#050608",
    text: "#B5FF73",
    accent: "#5CF4FF",
  },
  {
    key: "synthwave",
    background: "#1A0F2E",
    text: "#F8E7FF",
    accent: "#FF5CAA",
  },
  { key: "nebula", background: "#0A0F1B", text: "#D7E7FF", accent: "#FF66C4" },
  { key: "noir", background: "#0C0C0C", text: "#FFFFFF", accent: "#FFC857" },
  {
    key: "dawn-pastel",
    background: "#FFF4E6",
    text: "#1C1A24",
    accent: "#FF8C42",
  },
  { key: "seaside", background: "#E2F3FF", text: "#0F1C2E", accent: "#1FB6FF" },
  {
    key: "forest-dusk",
    background: "#1E2B1F",
    text: "#E8F5E9",
    accent: "#F6C177",
  },
  {
    key: "desert-sunset",
    background: "#2B1A0E",
    text: "#FDE7C5",
    accent: "#F59E0B",
  },
  { key: "glacier", background: "#0E1726", text: "#E9F4FF", accent: "#7DD3FC" },
  { key: "paper", background: "#FFFFFF", text: "#1F2937", accent: "#2563EB" },
  { key: "latte", background: "#F7EFE8", text: "#2C1810", accent: "#D97757" },
  { key: "moss", background: "#EEF6EB", text: "#1C2B1D", accent: "#6FBF73" },
  { key: "candy", background: "#FDF1FA", text: "#312033", accent: "#E75480" },
  {
    key: "electric-candy",
    background: "#FFEE33",
    text: "#B0006B",
    accent: "#00E5FF",
  },
  {
    key: "cyber-lime",
    background: "#101418",
    text: "#D7FF6B",
    accent: "#76E4F7",
  },
  {
    key: "deep-ocean",
    background: "#0B1724",
    text: "#E5F2FF",
    accent: "#64D2FF",
  },
  {
    key: "berry-night",
    background: "#2B0B3F",
    text: "#F6E1FF",
    accent: "#7C3AED",
  },
  { key: "sandbar", background: "#FFF8E1", text: "#1E1B1A", accent: "#F59E0B" },
  { key: "slate", background: "#111827", text: "#E5E7EB", accent: "#38BDF8" },
  {
    key: "acid-pop",
    background: "#F2FF4B",
    text: "#1A0F2E",
    accent: "#FF6AD5",
  },
];

export const themeMap = new Map(themes.map((theme) => [theme.key, theme]));
