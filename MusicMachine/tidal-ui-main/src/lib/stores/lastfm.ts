// Last.fm authentication and state store
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

interface LastFmState {
	isAuthenticated: boolean;
	sessionKey: string | null;
	username: string | null;
	currentTrackStartTime: number | null;
	scrobbledTracks: Set<number>;
	nowPlayingTrackId: number | null;
}

const STORAGE_KEY = 'lastfm_session';

// Load initial state from localStorage
function loadInitialState(): LastFmState {
	if (!browser) {
		return {
			isAuthenticated: false,
			sessionKey: null,
			username: null,
			currentTrackStartTime: null,
			scrobbledTracks: new Set(),
			nowPlayingTrackId: null
		};
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const data = JSON.parse(stored);
			return {
				isAuthenticated: !!data.sessionKey,
				sessionKey: data.sessionKey || null,
				username: data.username || null,
				currentTrackStartTime: null,
				scrobbledTracks: new Set(),
				nowPlayingTrackId: null
			};
		}
	} catch (error) {
		console.error('Failed to load Last.fm session from localStorage:', error);
	}

	return {
		isAuthenticated: false,
		sessionKey: null,
		username: null,
		currentTrackStartTime: null,
		scrobbledTracks: new Set(),
		nowPlayingTrackId: null
	};
}

// Save session to localStorage
function saveSession(sessionKey: string, username: string) {
	if (!browser) return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionKey, username }));
	} catch (error) {
		console.error('Failed to save Last.fm session to localStorage:', error);
	}
}

// Clear session from localStorage
function clearSession() {
	if (!browser) return;
	
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (error) {
		console.error('Failed to clear Last.fm session from localStorage:', error);
	}
}

function createLastFmStore() {
	const { subscribe, set, update } = writable<LastFmState>(loadInitialState());

	return {
		subscribe,
		login: (sessionKey: string, username: string) => {
			update(state => ({
				...state,
				isAuthenticated: true,
				sessionKey,
				username
			}));
			saveSession(sessionKey, username);
		},
		logout: () => {
			set({
				isAuthenticated: false,
				sessionKey: null,
				username: null,
				currentTrackStartTime: null,
				scrobbledTracks: new Set(),
				nowPlayingTrackId: null
			});
			clearSession();
		},
		setTrackStartTime: (trackId: number) => {
			update(state => ({
				...state,
				currentTrackStartTime: Date.now(),
				nowPlayingTrackId: trackId
			}));
		},
		markScrobbled: (trackId: number) => {
			update(state => {
				const newScrobbledTracks = new Set(state.scrobbledTracks);
				newScrobbledTracks.add(trackId);
				return {
					...state,
					scrobbledTracks: newScrobbledTracks
				};
			});
		},
		clearTrackState: () => {
			update(state => ({
				...state,
				currentTrackStartTime: null,
				nowPlayingTrackId: null
			}));
		},
		hasScrobbled: (trackId: number): boolean => {
			const state = get({ subscribe });
			return state.scrobbledTracks.has(trackId);
		}
	};
}

export const lastfmStore = createLastFmStore();
