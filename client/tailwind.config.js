/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Dynamic dark palette that shifts with accent color
        dark: {
          50: 'var(--bg-dark-50)',
          100: 'var(--bg-dark-100)',
          200: 'var(--bg-dark-200)',
          300: 'var(--bg-dark-300)',
          400: 'var(--bg-dark-400)',
          500: 'var(--bg-dark-500)',
          600: 'var(--bg-dark-600)',
          700: 'var(--bg-dark-700)',
          800: 'var(--bg-dark-800)',
          850: 'var(--bg-dark-850)',
          900: 'var(--bg-dark-900)',
          950: 'var(--bg-dark-950)',
        },
        // Dynamic primary color (mapped to --accent in CSS)
        primary: {
          50: 'hsl(var(--accent-h) var(--accent-s) 95% / <alpha-value>)',
          100: 'hsl(var(--accent-h) var(--accent-s) 90% / <alpha-value>)',
          200: 'hsl(var(--accent-h) var(--accent-s) 80% / <alpha-value>)',
          300: 'hsl(var(--accent-h) var(--accent-s) 70% / <alpha-value>)',
          400: 'hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) + 10%) / <alpha-value>)',
          500: 'hsl(var(--accent-h) var(--accent-s) var(--accent-l) / <alpha-value>)',
          600: 'hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) - 10%) / <alpha-value>)',
          700: 'hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) - 20%) / <alpha-value>)',
          800: 'hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) - 30%) / <alpha-value>)',
          900: 'hsl(var(--accent-h) var(--accent-s) calc(var(--accent-l) - 40%) / <alpha-value>)',
        },
        // Dynamic secondary color (mapped to --secondary in CSS)
        accent: {
          50: 'hsl(var(--secondary-h) var(--secondary-s) 95% / <alpha-value>)',
          100: 'hsl(var(--secondary-h) var(--secondary-s) 90% / <alpha-value>)',
          200: 'hsl(var(--secondary-h) var(--secondary-s) 80% / <alpha-value>)',
          300: 'hsl(var(--secondary-h) var(--secondary-s) 70% / <alpha-value>)',
          400: 'hsl(var(--secondary-h) var(--secondary-s) calc(var(--secondary-l) + 10%) / <alpha-value>)',
          500: 'hsl(var(--secondary-h) var(--secondary-s) var(--secondary-l) / <alpha-value>)',
          600: 'hsl(var(--secondary-h) var(--secondary-s) calc(var(--secondary-l) - 10%) / <alpha-value>)',
          700: 'hsl(var(--secondary-h) var(--secondary-s) calc(var(--secondary-l) - 20%) / <alpha-value>)',
          800: 'hsl(var(--secondary-h) var(--secondary-s) calc(var(--secondary-l) - 30%) / <alpha-value>)',
          900: 'hsl(var(--secondary-h) var(--secondary-s) calc(var(--secondary-l) - 40%) / <alpha-value>)',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
