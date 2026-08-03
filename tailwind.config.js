/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        personalytte: {
          dark: '#012A1A', // Aquele verde bem escuro da palavra "PERSONALYTTE"
          light: '#91CA05', // O verde limão da bola
          hover: '#014227', // Um tom levemente mais claro para quando passar o mouse
        }
      },
      fontFamily: {
        brand: ['Montserrat', 'sans-serif'], // Fonte geral mais premium
        display: ['Orbitron', 'sans-serif'], // Fonte para títulos (parecida com a do logo)
      }
    },
  },
  plugins: [],
}