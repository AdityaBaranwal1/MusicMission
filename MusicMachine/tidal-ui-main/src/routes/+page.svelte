<script lang="ts">
	import { onMount } from 'svelte';
	import LastFmCharts from '$lib/components/LastFmCharts.svelte';
	import type { Track } from '$lib/types';
	import { playerStore } from '$lib/stores/player';

	let { data } = $props();
	// Import SearchInterface directly for faster startup
	import SearchInterface from '$lib/components/SearchInterface.svelte';

	function handleTrackSelect(track: Track) {
		playerStore.setQueue([track], 0);
		playerStore.play();
	}

</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content="Cool music streaming haha" />
</svelte:head>

<div class="space-y-8">
	<!-- Hero Section -->
	<div class="py-8 text-center">
		<div class="mb-4 flex items-end justify-center gap-2">
			<h2
				class="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-5xl font-bold text-transparent"
			>
				{data.title}
			</h2>
			<span class="text-sm text-gray-400">v2.4</span>
		</div>
		<p class="mx-auto max-w-2xl text-xl text-gray-400">{data.slogan}</p>
	</div>

	<!-- Last.fm Charts -->
	<LastFmCharts />

	<!-- Search Interface -->
	<SearchInterface onTrackSelect={handleTrackSelect} />
</div>
