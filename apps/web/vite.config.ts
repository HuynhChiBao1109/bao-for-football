import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = resolve(process.cwd(), '../..');
  const env = loadEnv(mode, envDir, '');
  const processEnv = Object.fromEntries(
    Object.entries(env)
      .filter(([key]) => key.startsWith('VITE_'))
      .map(([key, value]) => [key, value]),
  );

  return {
    envDir,
    plugins: [tailwindcss(), react({ include: /\.[jt]sx?$/ })],
    preview: {
      allowedHosts: ['football.b4f.site'],
    },
    define: {
      'process.env': processEnv,
    },
  };
});
