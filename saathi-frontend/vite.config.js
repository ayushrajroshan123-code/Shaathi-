import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
  // Load environment variables for the current mode from .env files
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL;
  const isProduction = mode === 'production';

  // Build-time validation for production builds
  if (isProduction && command === 'build') {
    if (!apiUrl || !apiUrl.trim()) {
      throw new Error(
        'Production build failed: VITE_API_BASE_URL is required for production builds. ' +
        'Set VITE_API_BASE_URL to your production API origin (e.g. "https://api.saathi.community") in .env.production or environment before building.'
      );
    }

    try {
      const parsed = new URL(apiUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Invalid protocol "${parsed.protocol}". Must be http: or https:.`);
      }
    } catch (err) {
      throw new Error(
        `Production build failed: VITE_API_BASE_URL "${apiUrl}" is not a valid URL (${err.message}).`
      );
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
    },
  };
});
