import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontSize: {
        "news-title": ["12px", { lineHeight: "16px" }],
        "news-body": ["9px", { lineHeight: "13px" }],
      },
      colors: {
        brand: {
          DEFAULT: "#0b3d2e",
          accent: "#16a34a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
