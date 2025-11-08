import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        open: true
    },
    assetsInclude: ['**/*.wasm'],
    css: {
        devSourcemap: true,
    }
});
//# sourceMappingURL=vite.config.js.map