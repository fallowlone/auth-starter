import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same-origin /api proxy: auth cookies stay first-party, no CORS setup needed.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
});
