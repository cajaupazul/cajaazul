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
    },
  },
  plugins: [],
};
export default config;