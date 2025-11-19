<script lang="ts">
	import { onMount } from 'svelte';
	import { getTopTracks, getUserTopTracks, type LastFmTrack } from '$lib/lastfm';
	import { lastfmStore } from '$lib/stores/lastfm';
	import { losslessAPI } from '$lib/api';
	import { playerStore } from '$lib/stores/player';
	import type { Track } from '$lib/types';
	import { TrendingUp, Music, LoaderCircle } from 'lucide-svelte';

	let isLoading = $state(true);
	let tracks = $state<LastFmTrack[]>([]);
	let error = $state<string | null>(null);
	let searchingTidal = $state<Set<string>>(new Set());
	let tidalCache = $state<Map<string, Track | null>>(new Map());
	let tidalArtCache = $state<Record<string, string | null>>({});
	let mounted = $state(false);

	const isAuthenticated = $derived($lastfmStore.isAuthenticated);
	const username = $derived($lastfmStore.username);
	
	const CACHE_KEY = 'lastfm_charts_cache';
	const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	// Load charts immediately on mount
	onMount(() => {
		mounted = true;
		
		// Try to load from cache first for instant display
		const cached = localStorage.getItem(CACHE_KEY);
		if (cached) {
			try {
				const { data, timestamp } = JSON.parse(cached);
				const age = Date.now() - timestamp;
				
				// Show cached data immediately if less than 5 minutes old
				if (age < CACHE_DURATION) {
					tracks = data;
					isLoading = false;
					prefetchTidalArt();
					
					// Still fetch fresh data in background
					loadCharts();
					return;
				}
			} catch (e) {
				console.warn('Failed to parse cached charts:', e);
			}
		}
		
		// No valid cache, load normally
		loadCharts();
	});

	// Re-fetch when auth changes (but only if already mounted)
	$effect(() => {
		if (mounted && isAuthenticated !== undefined) {
			// Skip initial effect run, only reload on changes
			loadCharts();
		}
	});

	async function loadCharts() {
		isLoading = true;
		error = null;

		try {
			if (isAuthenticated && username) {
				// Fetch user's personalized top tracks
				tracks = await getUserTopTracks(username, 20, '7day');
				
				// Fall back to global charts if user has no listening history
				if (tracks.length === 0) {
					tracks = await getTopTracks(20);
				}
			} else {
				// Fetch global top tracks
				tracks = await getTopTracks(20);
			}
			
			// Cache the results for next time
			localStorage.setItem(CACHE_KEY, JSON.stringify({
				data: tracks,
				timestamp: Date.now()
			}));
			
			// Prefetch album art from Tidal for tracks without Last.fm images
			prefetchTidalArt();
		} catch (err) {
			console.error('Failed to load Last.fm charts:', err);
			error = err instanceof Error ? err.message : 'Failed to load charts';
			tracks = [];
		} finally {
			isLoading = false;
		}
	}
	
	// Prefetch album art from Tidal in the background (throttled)
	async function prefetchTidalArt() {
		// Prefetch all tracks with staggered requests
		const tracksToFetch = tracks;
		
		// Stagger requests to avoid rate limiting
		for (let i = 0; i < tracksToFetch.length; i++) {
			const track = tracksToFetch[i];
			const cacheKey = getCacheKey(track);
			if (!(cacheKey in tidalArtCache)) {
				// Delay each request by 150ms to stagger them (20 tracks * 150ms = 3 seconds total)
				setTimeout(() => {
					searchTidalForArt(track, cacheKey);
				}, i * 150);
			}
		}
	}
	
	async function searchTidalForArt(lastfmTrack: LastFmTrack, cacheKey: string) {
		try {
			const query = `${lastfmTrack.artist} ${lastfmTrack.name}`;
			const response = await losslessAPI.searchTracks(query);
			
			if (response?.items && response.items.length > 0) {
				const tidalTrack = response.items[0];
				const artUrl = tidalTrack.album?.cover 
					? losslessAPI.getCoverUrl(tidalTrack.album.cover, '640')
					: null;
				// Trigger reactivity by creating new object
				tidalArtCache = { ...tidalArtCache, [cacheKey]: artUrl };
			} else {
				tidalArtCache = { ...tidalArtCache, [cacheKey]: null };
			}
		} catch (err) {
			tidalArtCache = { ...tidalArtCache, [cacheKey]: null };
		}
	}
	
	// Get album art URL - prefers Tidal over Last.fm to avoid placeholders
	function getAlbumArt(track: LastFmTrack): string | null {
		const cacheKey = getCacheKey(track);
		const tidalArt = tidalArtCache[cacheKey];
		
		// Prefer Tidal album art if available
		if (tidalArt) return tidalArt;
		
		// Fall back to Last.fm image (may be placeholder)
		const lastfmImage = getLargestImage(track.image);
		return lastfmImage || null;
	}

	// Get the largest image URL from Last.fm
	function getLargestImage(images?: Array<{ '#text': string; size: string }>): string | null {
		if (!images || images.length === 0) return null;
		
		// Last.fm image sizes: small, medium, large, extralarge, mega
		const sizeOrder = ['mega', 'extralarge', 'large', 'medium', 'small'];
		
		for (const size of sizeOrder) {
			const img = images.find(i => i.size === size);
			if (img && img['#text'] && img['#text'].trim()) return img['#text'];
		}
		
		return null;
	}

	// Generate cache key for track
	function getCacheKey(track: LastFmTrack): string {
		return `${track.artist}-${track.name}`.toLowerCase();
	}

	// Search Tidal for matching track and cache result
	async function searchTidalAndPlay(lastfmTrack: LastFmTrack) {
		const cacheKey = getCacheKey(lastfmTrack);

		// Check cache first
		if (tidalCache.has(cacheKey)) {
			const cachedTrack = tidalCache.get(cacheKey);
			if (cachedTrack) {
				playerStore.setQueue([cachedTrack], 0);
				playerStore.play();
			}
			return;
		}

		// Mark as searching
		searchingTidal = new Set(searchingTidal).add(cacheKey);

		try {
			// Search Tidal for this track
			const query = `${lastfmTrack.artist} ${lastfmTrack.name}`;
			const response = await losslessAPI.searchTracks(query);
			
			if (response?.items && response.items.length > 0) {
				const tidalTrack = response.items[0];
				
				// Cache the result
				tidalCache.set(cacheKey, tidalTrack);
				
				// Play the track
				playerStore.setQueue([tidalTrack], 0);
				playerStore.play();
			} else {
				// Cache null result to avoid repeated searches
				tidalCache.set(cacheKey, null);
				console.warn(`No Tidal match found for: ${query}`);
			}
		} catch (err) {
			console.error('Failed to search Tidal:', err);
		} finally {
			// Remove from searching set
			const updated = new Set(searchingTidal);
			updated.delete(cacheKey);
			searchingTidal = updated;
		}
	}

	// Check if track is currently being searched
	function isSearching(track: LastFmTrack): boolean {
		return searchingTidal.has(getCacheKey(track));
	}

	// Format play count
	function formatPlaycount(count: number | undefined): string {
		if (!count) return '';
		if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
		if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
		return count.toString();
	}
</script>

<div class="lastfm-charts-section mb-8" style="contain: layout;">
	<div class="mb-4 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="rounded-full bg-red-500/20 p-2">
				<TrendingUp size={24} class="text-red-400" />
			</div>
			<div>
				<h2 class="text-2xl font-bold text-white">
					{#if isAuthenticated && username}
						Your Top Tracks
					{:else}
						Global Top Tracks
					{/if}
				</h2>
				<p class="text-sm text-gray-400">
					{#if isAuthenticated && username}
						Powered by your Last.fm listening history
					{:else}
						Trending now on Last.fm • Click Settings to connect Last.fm for personalized recommendations
					{/if}
				</p>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			{#each Array.from({ length: 6 }) as _}
				<div class="lastfm-track-card flex items-center gap-3 rounded-lg p-3" style="min-height: 82px;">
					<div class="h-14 w-14 flex-shrink-0 animate-pulse rounded bg-gray-700/80"></div>
					<div class="flex-1 space-y-2">
						<div class="h-4 w-3/4 animate-pulse rounded bg-gray-700/80"></div>
						<div class="h-3 w-1/2 animate-pulse rounded bg-gray-700/60"></div>
						<div class="h-3 w-1/3 animate-pulse rounded bg-gray-700/50"></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-900 bg-red-900/20 p-4 text-red-400">
			{error}
		</div>
	{:else if tracks.length > 0}
		<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
			{#each tracks as track, index}
				<button
					onclick={() => searchTidalAndPlay(track)}
					disabled={isSearching(track)}
					class="lastfm-track-card group flex items-center gap-3 rounded-lg p-3 text-left transition-all hover:scale-[1.02] disabled:cursor-wait disabled:opacity-70"
					style="min-height: 82px;"
				>
					<div class="relative flex-shrink-0" style="width: 56px; height: 56px;">
						{#if getAlbumArt(track)}
							<img
								src={getAlbumArt(track)}
								alt={track.name}
								class="h-14 w-14 rounded object-cover"
								loading="lazy"
								width="56"
								height="56"
							/>
						{:else}
							<div class="flex h-14 w-14 items-center justify-center rounded bg-gray-700">
								<Music size={24} class="text-gray-500" />
							</div>
						{/if}
						{#if isSearching(track)}
							<div class="absolute inset-0 flex items-center justify-center rounded bg-black/60">
								<LoaderCircle size={24} class="animate-spin text-white" />
							</div>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-baseline gap-2">
							<span class="text-sm font-bold text-gray-500">#{index + 1}</span>
							<h3 class="truncate font-semibold text-white group-hover:text-blue-400">
								{track.name}
							</h3>
						</div>
						<p class="truncate text-sm text-gray-400">{track.artist}</p>
						{#if track.playcount || track.listeners}
							<p class="text-xs text-gray-500">
								{#if track.playcount}
									{formatPlaycount(track.playcount)} plays
								{:else if track.listeners}
									{formatPlaycount(track.listeners)} listeners
								{/if}
							</p>
						{/if}
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<div class="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
			<Music size={48} class="mx-auto mb-3 text-gray-600" />
			<p class="text-gray-400">No tracks available</p>
		</div>
	{/if}
</div>

<style>
	.lastfm-charts-section {
		animation: fadeIn 0.4s ease-in;
		min-height: 400px;
		will-change: auto;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.lastfm-track-card {
		background: transparent;
		border: 1px solid rgba(148, 163, 184, 0.15);
		backdrop-filter: blur(var(--perf-blur-medium, 28px)) saturate(var(--perf-saturate, 160%));
		-webkit-backdrop-filter: blur(var(--perf-blur-medium, 28px))
			saturate(var(--perf-saturate, 160%));
		box-shadow: 0 4px 12px rgba(2, 6, 23, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04);
		transition:
			border-color 0.2s ease,
			box-shadow 0.3s ease,
			transform 0.2s ease;
	}

	.lastfm-track-card:hover:not(:disabled) {
		border-color: rgba(59, 130, 246, 0.4);
		box-shadow: 0 6px 18px rgba(59, 130, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.lastfm-track-card:active:not(:disabled) {
		transform: scale(0.98);
	}
</style>
