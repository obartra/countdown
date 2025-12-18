export type ThemeDefinition = {
  key: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent?: string;
};

export const DEFAULT_THEME_KEY = "midnight";

export const themes: ThemeDefinition[] = [
  {
    key: "midnight",
    background: "#0B1021",
    surface: "#0F172A",
    text: "#F2F5FF",
    textSecondary: "#96A0BA",
    accent: "#7DD3FC",
  },
  {
    key: "aurora-neon",
    background: "#050608",
    surface: "#131A11",
    text: "#B5FF73",
    textSecondary: "#648C42",
    accent: "#5CF4FF",
  },
  {
    key: "synthwave",
    background: "#1A0F2E",
    surface: "#2C203F",
    text: "#F8E7FF",
    textSecondary: "#9587A2",
    accent: "#FF5CAA",
  },
  {
    key: "noir",
    background: "#0C0C0C",
    surface: "#1F1F1F",
    text: "#FFFFFF",
    textSecondary: "#878787",
    accent: "#FFC857",
  },
  {
    key: "dawn-pastel",
    background: "#FFF4E6",
    surface: "#F1E7DA",
    text: "#1C1A24",
    textSecondary: "#6D6769",
    accent: "#FF8C42",
  },
  {
    key: "seaside",
    background: "#E2F3FF",
    surface: "#D5E6F2",
    text: "#0F1C2E",
    textSecondary: "#596777",
    accent: "#1FB6FF",
  },
  {
    key: "forest-dusk",
    background: "#1E2B1F",
    surface: "#2E3B2F",
    text: "#E8F5E9",
    textSecondary: "#97A498",
    accent: "#F6C177",
  },
  {
    key: "desert-sunset",
    background: "#2B1A0E",
    surface: "#3C2A1D",
    text: "#FDE7C5",
    textSecondary: "#A69279",
    accent: "#F59E0B",
  },
  {
    key: "glacier",
    background: "#0E1726",
    surface: "#202937",
    text: "#E9F4FF",
    textSecondary: "#86919D",
    accent: "#7DD3FC",
  },
  {
    key: "paper",
    background: "#FFFFFF",
    surface: "#F2F2F3",
    text: "#1F2937",
    textSecondary: "#686F78",
    accent: "#2563EB",
  },
  {
    key: "latte",
    background: "#F7EFE8",
    surface: "#EBE2DB",
    text: "#2C1810",
    textSecondary: "#72625B",
    accent: "#D97757",
  },
  {
    key: "moss",
    background: "#EEF6EB",
    surface: "#E1EADF",
    text: "#1C2B1D",
    textSecondary: "#5E6B5E",
    accent: "#6FBF73",
  },
  {
    key: "candy",
    background: "#FDF1FA",
    surface: "#F1E4EE",
    text: "#312033",
    textSecondary: "#726373",
    accent: "#E75480",
  },
  {
    key: "cyber-lime",
    background: "#101418",
    surface: "#20271F",
    text: "#D7FF6B",
    textSecondary: "#7C9445",
    accent: "#76E4F7",
  },
  {
    key: "deep-ocean",
    background: "#0B1724",
    surface: "#1C2936",
    text: "#E5F2FF",
    textSecondary: "#84919E",
    accent: "#64D2FF",
  },
  {
    key: "berry-night",
    background: "#2B0B3F",
    surface: "#3B1C4E",
    text: "#F6E1FF",
    textSecondary: "#A187AE",
    accent: "#7C3AED",
  },
  {
    key: "sandbar",
    background: "#FFF8E1",
    surface: "#F2EBD5",
    text: "#1E1B1A",
    textSecondary: "#6E6961",
    accent: "#F59E0B",
  },
  {
    key: "slate",
    background: "#111827",
    surface: "#222937",
    text: "#E5E7EB",
    textSecondary: "#8C9099",
    accent: "#38BDF8",
  },
];

export const themeMap = new Map(themes.map((theme) => [theme.key, theme]));
