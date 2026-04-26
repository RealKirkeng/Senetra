/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./main.js",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': {
          DEFAULT: '#69a151',
          light: '#84cc16',
          dark: '#4d7c3d',
        },
        'b2g-blue': '#1e3a8a', 
        'b2g-accent': '#3b82f6',
      }
    },
  },
  plugins: [],
}
