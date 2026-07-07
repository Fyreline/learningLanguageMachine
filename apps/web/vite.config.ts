import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// For GitHub Pages *project* sites the app is served from /<repo>/, so a
// deploy workflow sets VITE_BASE=/learningLanguageMachine/ at build time
// (docs/ARCHITECTURE.md §5). Defaults to '/' for local dev. Michi's dev
// server owns port 5174 — Mishka Hub's owns 5173 — so both can run
// side-by-side on the household machine.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
})
