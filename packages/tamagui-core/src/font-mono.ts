// Monospace terminal font for cyberpunk theme
import { createFont, isWeb } from "@tamagui/core";

const size = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 15,
  true: 15,
  lg: 17,
  xl: 19,
  "2xl": 23,
  "3xl": 29,
  "4xl": 35,
  "5xl": 47,
  "6xl": 59,
} as const;

const lineHeight = {
  xs: 15,
  sm: 19,
  md: 23,
  base: 23,
  true: 23,
  lg: 27,
  xl: 27,
  "2xl": 31,
  "3xl": 35,
  "4xl": 39,
  "5xl": 47,
  "6xl": 59,
} as const;

const weight = {
  true: "400",
  base: "400",
  medium: "500",
  semiBold: "600",
  bold: "700",
} as const;

const face = {
  400: { normal: "CourierNew" },
  500: { normal: "CourierNew" },
  600: { normal: "CourierNew" },
  700: { normal: "CourierNew" },
};

const letterSpacing = {
  base: 0,
  true: 0,
} as const;

export const monoFont = createFont({
  family: isWeb
    ? '"Courier New", Consolas, "Liberation Mono", Menlo, Monaco, monospace'
    : "CourierNew",
  size,
  lineHeight,
  weight,
  letterSpacing,
  face,
});
