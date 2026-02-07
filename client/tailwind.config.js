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
        // Refined neutral charcoal with subtle warmth
        dark: {
          50: '#fafafa',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          850: '#1c1917',
          900: '#171412',
          950: '#0c0a09',
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
