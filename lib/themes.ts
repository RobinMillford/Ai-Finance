// Shared theme configuration for consistent color themes across market types
export const marketThemes = {
  stock: {
    primary: "#3B82F6", // blue-500
    secondary: "#4F46E5", // indigo-600
    gradientStart: "#3B82F6",
    gradientEnd: "#4F46E5",
    name: "Stocks"
  },
  forex: {
    primary: "#10B981", // green-500
    secondary: "#059669", // emerald-600
    gradientStart: "#10B981",
    gradientEnd: "#059669",
    name: "Forex"
  },
  crypto: {
    primary: "#F59E0B", // amber-500
    secondary: "#D97706", // amber-600
    gradientStart: "#F59E0B",
    gradientEnd: "#D97706",
    name: "Crypto"
  }
};

export type MarketType = keyof typeof marketThemes;