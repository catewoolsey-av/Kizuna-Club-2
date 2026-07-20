/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kizuna-navy': '#1a365d',
        'kizuna-navy-light': '#2c5282',
        'kizuna-gold': '#b7791f',
        'kizuna-gold-light': '#d69e2e',
        'kizuna-gold-subtle': '#f6e9d0',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Hiragino Sans', 'Noto Sans JP', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
