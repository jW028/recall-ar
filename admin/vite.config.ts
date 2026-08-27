import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// '@' and '@app' both point at the Expo app's src so the dashboard can import its pure helpers.
// Only genuinely pure modules may be imported through these — anything reaching expo-sqlite,
// react-native or expo-secure-store will not resolve in a browser build.
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@app': fileURLToPath(new URL('../src', import.meta.url)),
            '@': fileURLToPath(new URL('../src', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        // The shared helpers live outside this Vite root, so the dev server has to be allowed to read them.
        fs: { allow: ['..'] },
    },
});
