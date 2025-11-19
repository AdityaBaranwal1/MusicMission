// Tauri HTTP wrapper with fallback to CORS proxy
// This module provides a unified HTTP interface that works in both Tauri desktop and web browser

import { fetchWithCORS } from './config';

// Check if we're running in Tauri
function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Smart fetch that tries Tauri's native HTTP client first (bypasses CORS),
 * then falls back to the existing fetchWithCORS proxy system if Tauri is unavailable
 */
export async function smartFetch(url: string, options?: RequestInit): Promise<Response> {
	// If running in Tauri, try native HTTP client first
	if (isTauri()) {
		try {
			// @ts-expect-error - Tauri types not in scope yet
			const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
			
			// Convert standard fetch options to Tauri format
			const tauriOptions: any = {
				method: options?.method || 'GET',
				headers: options?.headers || {},
			};
			
			if (options?.body) {
				tauriOptions.body = options.body;
			}

			console.log('[Tauri HTTP] Using native fetch for:', url);
			const response = await tauriFetch(url, tauriOptions);
			
			// Convert Tauri response to standard Response format
			return new Response(response.data as any, {
				status: response.status,
				statusText: response.statusText || '',
				headers: new Headers(response.headers as any)
			});
		} catch (error) {
			console.warn('[Tauri HTTP] Native fetch failed, falling back to proxy:', error);
			// Fall through to proxy
		}
	}

	// Fall back to existing CORS proxy system
	console.log('[Web HTTP] Using CORS proxy for:', url);
	return fetchWithCORS(url, options);
}

/**
 * Get the appropriate fetch function based on environment
 * This allows existing code to be easily migrated
 */
export function getHttpClient(): typeof fetch {
	return smartFetch as typeof fetch;
}
