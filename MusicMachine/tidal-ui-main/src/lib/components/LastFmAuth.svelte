<script lang="ts">
	import { authenticate, getUserInfo, type LastFmUser } from '$lib/lastfm';
	import { lastfmStore } from '$lib/stores/lastfm';
	import { X, LoaderCircle, LogIn, Music2 } from 'lucide-svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let username = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	async function handleSubmit() {
		if (!username.trim() || !password.trim()) {
			error = 'Please enter both username and password';
			return;
		}

		isLoading = true;
		error = null;

		try {
			// Authenticate and get session key
			const sessionKey = await authenticate(username.trim(), password.trim());
			
			// Get user info
			const userInfo: LastFmUser = await getUserInfo(username.trim());
			
			// Store session
			lastfmStore.login(sessionKey, userInfo.name);
			
			// Close modal
			onClose();
		} catch (err) {
			console.error('Last.fm authentication failed:', err);
			error = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
		} finally {
			isLoading = false;
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSubmit();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}
</script>

<div
	role="dialog"
	aria-modal="true"
	aria-labelledby="lastfm-auth-title"
	tabindex="-1"
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div class="lastfm-auth-modal w-full max-w-md rounded-lg p-6 shadow-2xl">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-full bg-red-500/20 p-2">
					<Music2 size={24} class="text-red-400" />
				</div>
				<h2 id="lastfm-auth-title" class="text-2xl font-bold text-white">Connect Last.fm</h2>
			</div>
			<button
				onclick={onClose}
				class="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
				aria-label="Close dialog"
			>
				<X size={20} />
			</button>
		</div>

		<!-- Description -->
		<p class="mb-6 text-sm text-gray-300">
			Sign in with your Last.fm account to enable scrobbling and get personalized music recommendations.
		</p>

		<!-- Error Message -->
		{#if error}
			<div class="mb-4 rounded-lg border border-red-900 bg-red-900/20 p-3 text-sm text-red-400">
				{error}
			</div>
		{/if}

		<!-- Form -->
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			<div>
				<label for="lastfm-username" class="mb-1 block text-sm font-medium text-gray-300">
					Username
				</label>
				<input
					id="lastfm-username"
					type="text"
					bind:value={username}
					onkeypress={handleKeyPress}
					disabled={isLoading}
					placeholder="Enter your Last.fm username"
					class="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60"
					required
				/>
			</div>

			<div>
				<label for="lastfm-password" class="mb-1 block text-sm font-medium text-gray-300">
					Password
				</label>
				<input
					id="lastfm-password"
					type="password"
					bind:value={password}
					onkeypress={handleKeyPress}
					disabled={isLoading}
					placeholder="Enter your Last.fm password"
					class="w-full rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-60"
					required
				/>
			</div>

			<!-- Buttons -->
			<div class="flex gap-3 pt-2">
				<button
					type="button"
					onclick={onClose}
					disabled={isLoading}
					class="flex-1 rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={isLoading || !username.trim() || !password.trim()}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if isLoading}
						<LoaderCircle size={18} class="animate-spin" />
						<span>Connecting...</span>
					{:else}
						<LogIn size={18} />
						<span>Connect</span>
					{/if}
				</button>
			</div>
		</form>

		<!-- Privacy Note -->
		<p class="mt-4 text-xs text-gray-500">
			Your credentials are sent directly to Last.fm's servers. We don't store your password.
		</p>
	</div>
</div>

<style>
	.lastfm-auth-modal {
		background: rgba(17, 24, 39, 0.95);
		border: 1px solid rgba(148, 163, 184, 0.2);
		backdrop-filter: blur(32px) saturate(160%);
		-webkit-backdrop-filter: blur(32px) saturate(160%);
		animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
