/**
 * lib/ds.ts — re-exports the Nexus Precision design tokens from components/ui
 * All pages can import DS from either @/lib/ds or @/components/ui — same tokens.
 */

export const DS = {
  // Surface hierarchy (tonal layering — no 1px borders)
  surface:     "#f7f9fb",
  surfaceLow:  "#f2f4f6",
  card:        "#ffffff",
  surfaceHigh: "#e6e8ea",
  surfaceTop:  "#e0e3e5",
  cardEl:      "#f2f4f6",   // compat alias
  cardDeep:    "#e2dfff",   // compat alias

  // Typography
  text:        "#191c1e",
  onSurf:      "#191c1e",   // compat alias
  textMuted:   "#464555",
  onSurVar:    "#464555",   // compat alias
  outline:     "#777587",
  outlineVar:  "#c7c4d8",
  muted:       "#9CA3AF",   // compat alias

  // Brand
  primary:      "#4F46E5",
  primaryDp:    "#3525cd",
  primaryFix:   "#e2dfff",
  primarySoft:  "#e2dfff",  // compat alias
  sidebar:      "#181445",

  // Status
  green:        "#059669",
  greenBg:      "#ECFDF5",
  greenSoft:    "#ECFDF5",  // compat alias
  amber:        "#B45309",
  amberBg:      "#FFFBEB",
  amberSoft:    "#FFFBEB",  // compat alias
  red:          "#DC2626",
  redBg:        "#FEF2F2",
  redSoft:      "#FEF2F2",  // compat alias
  blue:         "#2563EB",
  blueBg:       "#EFF6FF",
  blueSoft:     "#EFF6FF",  // compat alias

  // Shadows
  shadow:       "0 2px 12px rgba(25,28,30,0.05), 0 1px 3px rgba(25,28,30,0.04)",
  shadowUp:     "0 8px 24px rgba(79,70,229,0.08)",
};
