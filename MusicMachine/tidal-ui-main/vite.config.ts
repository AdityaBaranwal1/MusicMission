import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	process.env = { ...process.env, ...env };

	const parsedPort = env.PORT ? Number.parseInt(env.PORT, 10) : undefined;
	const isTauri = !!process.env.TAURI_ENV_PLATFORM;

	return {
		plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
		
		// Tauri-specific configuration
		clearScreen: false,
		
		server: {
			// Tauri expects a fixed port to connect to
			port: isTauri ? 1420 : (Number.isFinite(parsedPort) ? parsedPort : undefined),
			strictPort: isTauri,
			host: isTauri ? '127.0.0.1' : '0.0.0.0',
			hmr: isTauri ? { host: '127.0.0.1', port: 1420 } : undefined,
			watch: {
				usePolling: !isTauri,
				// Ignore Tauri's Rust build files
				ignored: isTauri ? ['**/src-tauri/**'] : undefined
			}
		},
		
		optimizeDeps: {
			exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
			// Pre-bundle these dependencies for faster loading
			include: [
				'jszip',
				'lucide-svelte',
				'svelte/motion',
				'svelte/transition'
			],
			// Force optimization on first load
			force: false
		},
		
		build: {
			// Optimize chunk splitting for better caching
			minify: 'esbuild',
			target: 'esnext',
			rollupOptions: {
				output: {
					manualChunks: {
						// Split vendor chunks for better caching
						'vendor-icons': ['lucide-svelte'],
						'vendor-zip': ['jszip']
					}
				}
			}
		},
		
		ssr: {
			external: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
		}
	};
});
