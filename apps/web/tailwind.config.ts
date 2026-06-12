import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colores Blackboard (Mapped to CSS Variables)
        'bb-dark': 'var(--bb-dark)',
        'bb-darker': 'var(--bb-darker)',
        'bb-sidebar': 'var(--bb-sidebar)',
        'bb-border': 'var(--bb-border)',
        'bb-hover': 'var(--bb-hover)',
        'bb-card': 'var(--bb-card)',
        'bb-text': 'var(--bb-text)',
        'bb-text-secondary': 'var(--bb-text-secondary)',

        // Colores pastel (mantienen identidad de facultad)
        'blue-pastel': '#E3F2FD',
        'teal-pastel': '#E0F2F1',
        'emerald-pastel': '#E8F5E9',

        // Landing Material Colors
        "secondary-container": "#316bf3",
        "surface-variant": "#d8e3fb",
        "on-primary": "#ffffff",
        "on-surface": "#111c2d",
        "surface-tint": "#405f91",
        "secondary-fixed-dim": "#b4c5ff",
        "on-error-container": "#93000a",
        "on-secondary": "#ffffff",
        "outline-variant": "#c4c6d0",
        "inverse-surface": "#263143",
        "tertiary-container": "#292c2e",
        "primary-fixed-dim": "#a9c7ff",
        "tertiary-fixed": "#e0e3e5",
        "tertiary": "#141819",
        "primary": "#001736",
        "on-surface-variant": "#43474f",
        "on-secondary-fixed": "#00174b",
        "on-tertiary-container": "#909395",
        "error": "#ba1a1a",
        "on-secondary-container": "#fefcff",
        "surface-container-highest": "#d8e3fb",
        "on-tertiary-fixed": "#191c1e",
        "primary-fixed": "#d6e3ff",
        "on-tertiary-fixed-variant": "#444749",
        "outline": "#747780",
        "surface-container-lowest": "#ffffff",
        "on-primary-fixed-variant": "#264778",
        "primary-container": "#002b5b",
        "on-primary-container": "#7594ca",
        "inverse-on-surface": "#ecf1ff",
        "tertiary-fixed-dim": "#c4c7c9",
        "surface-dim": "#cfdaf2",
        "surface": "#f9f9ff",
        "on-primary-fixed": "#001b3d",
        "inverse-primary": "#a9c7ff",
        "error-container": "#ffdad6",
        "surface-bright": "#f9f9ff",
        "on-error": "#ffffff",
        "secondary-fixed": "#dbe1ff",
        "surface-container-high": "#dee8ff",
        "on-tertiary": "#ffffff",
        "on-background": "#111c2d",
        "background": "#f9f9ff",
        "on-secondary-fixed-variant": "#003ea8",
        "surface-container": "#e7eeff",
        "secondary": "#0051d5",
        "surface-container-low": "#f0f3ff"
      },
      backgroundColor: {
        'faculty-primary': 'var(--faculty-primary)',
        'faculty-secondary': 'var(--faculty-secondary)',
        'faculty-dark': 'var(--faculty-dark)',
        'faculty-light': 'var(--faculty-light)',
      },
      borderColor: {
        'faculty-primary': 'var(--faculty-primary)',
      },
      textColor: {
        'faculty-primary': 'var(--faculty-primary)',
      },
      spacing: {
        "section-gap": "80px",
        "gutter": "24px",
        "unit": "4px",
        "container-max": "1280px",
        "margin-desktop": "40px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "margin-mobile": "16px",
        "stack-lg": "32px"
      },
      fontFamily: {
        "body-md": ["Inter", "sans-serif"],
        "label-lg": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "label-md": ["Inter", "sans-serif"],
        "display-lg-mobile": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "headline-xl": ["Inter", "sans-serif"],
        "display-lg": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"]
      },
      fontSize: {
        "body-md": ["16px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "label-lg": ["14px", { "lineHeight": "1.2", "letterSpacing": "0.05em", "fontWeight": "600" }],
        "body-sm": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }],
        "label-md": ["12px", { "lineHeight": "1.2", "fontWeight": "500" }],
        "display-lg-mobile": ["32px", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "800" }],
        "headline-md": ["20px", { "lineHeight": "1.4", "fontWeight": "600" }],
        "body-lg": ["18px", { "lineHeight": "1.6", "fontWeight": "400" }],
        "headline-xl": ["36px", { "lineHeight": "1.2", "fontWeight": "700" }],
        "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "800" }],
        "headline-lg": ["24px", { "lineHeight": "1.3", "fontWeight": "700" }]
      }
    },
  },
  plugins: [],
};
export default config;