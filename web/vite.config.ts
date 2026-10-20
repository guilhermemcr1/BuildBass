import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, lazyPlugins } from 'vite-plus';

export default defineConfig({
    plugins: lazyPlugins(() => [
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
    ]),
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        // O orçamento real é ≤ 250 KB gzip do JS inicial (plan.md); o React Aria passa do limite
        // padrão de 500 KB minificado sem estourar esse orçamento.
        chunkSizeWarningLimit: 700,
    },
    test: {
        environment: 'jsdom',
        include: ['src/**/*.test.{ts,tsx}'],
        setupFiles: ['src/test/setup.ts'],
    },
    lint: {
        ignorePatterns: ['node_modules/**', 'dist/**', 'src/components/ui/*'],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: ['dist/**', 'src/components/ui/*'],
        sortTailwindcss: {
            functions: ['clsx', 'cn'],
            stylesheet: 'src/styles/app.css',
        },
    },
});
