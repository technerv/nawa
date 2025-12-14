/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1a202c",
        secondary: "#2d3748",
        accent: "#4a5568",
        highlight: "#718096",
        light: "#f7fafc",
      }
    },
  },
  plugins: [],
}