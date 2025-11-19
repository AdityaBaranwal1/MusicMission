# Tauri Migration Plan - MusicMachine Desktop App

## Executive Summary
Migrate MusicMachine from SvelteKit SSR to Tauri v2 desktop application to enable native file downloads, bypass CORS restrictions, and provide a professional desktop experience.

---

## 1. Current Architecture Analysis

### 1.1 Proxy System (`src/lib/config.ts`)
**Current Implementation:**
- **20+ Tidal proxy servers** with weighted load balancing
- Automatic failover across servers (kraken.squid.wtf, triton.squid.wtf, etc.)
- Regional targeting (auto/us/eu)
- CORS workaround via `/api/proxy` server route
- Retry logic with token refresh on 401 errors

**Key Functions:**
- `selectApiTarget()` - Weighted random server selection
- `fetchWithCORS()` - Attempts multiple servers with fallback
- `getProxiedUrl()` - Wraps URLs for CORS proxy
- `isProxyTarget()` - Determines if URL needs proxying

### 1.2 Server Routes (To Be Eliminated)

#### `/api/proxy/+server.ts`
**Purpose:** CORS bypass for Tidal API calls
**Features:**
- Redis caching (300s default, 120s for tracks, 300s for search)
- Header forwarding (User-Agent, Range, Authorization)
- Retry logic for invalid tokens (11002 subStatus)
- gzip/identity encoding handling

**API Calls Proxied:**
- Stream URLs (`/track/`)
- Search queries (`/search/`)
- Album/Artist/Playlist metadata
- Cover images

#### `/api/songlink/+server.ts`
**Purpose:** Fetch cross-platform song links
**Features:**
- Primary API: `api.song.link`
- Backup API: `tracks.monochrome.tf`
- 30-day Redis caching
- Fallback handling

#### `/api/spotify-playlist/+server.ts`
**Purpose:** Extract tracks from Spotify playlists
**Features:**
- TOTP-based authentication
- Session token generation
- GraphQL query for playlist data
- Pagination (343 tracks per request)

#### `/api/artwork/[type]/[id]/[size]/+server.ts`
**Purpose:** Proxy cover images with proper headers
**Not in repo** - May be deprecated

### 1.3 Tidal API Integration (`src/lib/api.ts`)

**Core Endpoints:**
1. **Search**
   - `GET /search` - Multi-type search (tracks, albums, artists, playlists)
   - Uses `fetchWithCORS` with retry logic

2. **Streaming**
   - `GET /track/{id}/stream` - Returns CDN URL for FLAC/AAC
   - `GET /track/{id}/stream/dash` - Returns DASH manifest for Hi-Res
   - Quality selection: `HI_RES_LOSSLESS`, `LOSSLESS`, `HIGH`, `LOW`

3. **Metadata**
   - `GET /track/{id}` - Track details
   - `GET /album/{id}` - Album info + track list
   - `GET /artist/{id}` - Artist details
   - `GET /playlist/{uuid}` - Playlist tracks

4. **Covers**
   - CDN URLs: `resources.tidal.com/images/{id}/{size}x{size}.jpg`
   - Direct access (no authentication)

**Authentication:**
- Token-based (embedded in proxy servers)
- Automatic refresh on 401/11002 errors
- No user auth required (using shared tokens)

---

## 2. Tauri Architecture Design

### 2.1 HTTP Client Replacement

**Replace `fetchWithCORS()` with Tauri HTTP Plugin:**

```rust
// src-tauri/src/http_client.rs
use tauri_plugin_http::reqwest;

pub async fn fetch_with_retry(
    url: &str,
    headers: Vec<(String, String)>,
    max_attempts: u8
) -> Result<Response, Error> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;
    
    for attempt in 1..=max_attempts {
        let mut request = client.get(url);
        for (key, value) in &headers {
            request = request.header(key, value);
        }
        
        match request.send().await {
            Ok(response) if response.status().is_success() => {
                return Ok(response);
            }
            Ok(response) if response.status() == 401 => {
                // Retry with different server
                continue;
            }
            Err(e) if attempt < max_attempts => {
                tokio::time::sleep(Duration::from_millis(500)).await;
                continue;
            }
            Err(e) => return Err(e.into()),
        }
    }
    Err(Error::AllServersFailed)
}
```

**Frontend Integration:**
```typescript
// src/lib/tauri-http.ts
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

export async function tauriRequest(url: string, options?: RequestInit) {
    return await tauriFetch(url, {
        ...options,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MusicMachine/1.0)',
            ...options?.headers
        }
    });
}
```

### 2.2 Proxy Server Selection

**Tauri Command for Server Selection:**
```rust
#[tauri::command]
async fn select_tidal_server() -> Result<String, String> {
    let servers = vec![
        ("kraken.squid.wtf", 20),
        ("triton.squid.wtf", 20),
        ("zeus.squid.wtf", 19),
        // ... all 20+ servers
    ];
    
    // Weighted random selection
    let total_weight: u32 = servers.iter().map(|(_, w)| w).sum();
    let random = rand::random::<u32>() % total_weight;
    // ... selection logic
    
    Ok(selected_server.to_string())
}
```

**Frontend:**
```typescript
// src/lib/config-tauri.ts
import { invoke } from '@tauri-apps/api/core';

export async function selectApiTarget(): Promise<string> {
    return await invoke('select_tidal_server');
}
```

### 2.3 Caching Strategy

**Replace Redis with Tauri Store Plugin:**

```rust
// src-tauri/src/cache.rs
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn cache_get(app: AppHandle, key: String) -> Option<CachedResponse> {
    let store = app.store("cache.json")?;
    store.get(key)
}

#[tauri::command]
async fn cache_set(app: AppHandle, key: String, value: CachedResponse, ttl: u64) {
    let store = app.store("cache.json")?;
    store.set(key, CacheEntry {
        value,
        expires_at: SystemTime::now() + Duration::from_secs(ttl)
    });
    store.save();
}
```

**Alternatives:**
- In-memory Map (simpler, loses cache on restart)
- SQLite with `tauri-plugin-sql` (persistent, queryable)

---

## 3. File System Architecture

### 3.1 Download System

**Tauri FS Command:**
```rust
use tauri_plugin_fs;
use tauri::api::path::audio_dir;

#[tauri::command]
async fn download_track(
    track_id: String,
    quality: String,
    filename: String
) -> Result<String, String> {
    // 1. Fetch stream URL
    let stream_url = fetch_stream_url(&track_id, &quality).await?;
    
    // 2. Download audio data
    let audio_data = fetch_audio_data(&stream_url).await?;
    
    // 3. Get user's Music folder
    let music_dir = audio_dir().ok_or("Cannot access music directory")?;
    let file_path = music_dir.join(&filename);
    
    // 4. Write file
    fs::write(&file_path, audio_data).await?;
    
    // 5. Return path
    Ok(file_path.to_string_lossy().to_string())
}
```

**Frontend:**
```typescript
// src/lib/downloads-tauri.ts
import { invoke } from '@tauri-apps/api/core';
import { audioDir } from '@tauri-apps/api/path';

export async function downloadTrack(track: Track, quality: AudioQuality) {
    const filename = sanitizeFilename(track);
    const path = await invoke('download_track', {
        trackId: track.id,
        quality,
        filename
    });
    
    return path; // Full path to downloaded file
}
```

### 3.2 Metadata Embedding

**Option 1: Use `tauri-plugin-shell` to call FFmpeg**
```rust
#[tauri::command]
async fn embed_metadata(
    file_path: String,
    metadata: TrackMetadata
) -> Result<(), String> {
    let output = Command::new("ffmpeg")
        .args([
            "-i", &file_path,
            "-metadata", &format!("title={}", metadata.title),
            "-metadata", &format!("artist={}", metadata.artist),
            // ... more metadata
            "-codec", "copy",
            &format!("{}.tmp", file_path)
        ])
        .output()
        .await?;
    
    fs::rename(format!("{}.tmp", file_path), file_path)?;
    Ok(())
}
```

**Option 2: Use `id3` Rust crate (native, no FFmpeg dependency)**
```rust
use id3::{Tag, TagLike};

#[tauri::command]
fn embed_id3_metadata(
    file_path: String,
    metadata: TrackMetadata
) -> Result<(), String> {
    let mut tag = Tag::read_from_path(&file_path)
        .unwrap_or_else(|_| Tag::new());
    
    tag.set_title(&metadata.title);
    tag.set_artist(&metadata.artist);
    tag.set_album(&metadata.album);
    // ... more fields
    
    tag.write_to_path(&file_path, id3::Version::Id3v24)?;
    Ok(())
}
```

---

## 4. Last.fm Integration

### 4.1 Current Implementation (No Changes Needed)
- `src/lib/lastfm.ts` - Pure TypeScript API client
- `src/lib/stores/lastfm.ts` - Svelte store for auth state
- Components work in browser context

### 4.2 Tauri Considerations
**✅ Works as-is:**
- Last.fm API uses standard HTTPS (no CORS issues)
- MD5 signing uses Web Crypto API (available in Tauri WebView)
- localStorage works in Tauri

**Optional Enhancement:**
```rust
// Store Last.fm session in secure storage
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn store_lastfm_session(app: AppHandle, session_key: String, username: String) {
    let store = app.store("secure.json")?;
    store.set("lastfm_session", json!({
        "key": session_key,
        "user": username
    }));
    store.save();
}
```

---

## 5. Error Handling & Retry Logic

### 5.1 Network Failures

**Rust Error Types:**
```rust
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Network request failed: {0}")]
    NetworkError(String),
    
    #[error("All Tidal servers failed")]
    AllServersFailed,
    
    #[error("Invalid token (11002)")]
    TokenInvalid,
    
    #[error("Rate limited (429)")]
    RateLimited,
}
```

**Retry Strategy:**
```rust
const MAX_RETRIES: u8 = 3;
const RETRY_DELAY_MS: u64 = 500;

async fn fetch_with_fallback(servers: &[String]) -> Result<Response> {
    for server in servers {
        match fetch_from_server(server).await {
            Ok(response) => return Ok(response),
            Err(ApiError::TokenInvalid) => {
                // Try next server immediately
                continue;
            }
            Err(e) => {
                tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
                continue;
            }
        }
    }
    Err(ApiError::AllServersFailed)
}
```

### 5.2 Frontend Error Display

**Toast Notifications:**
```typescript
// src/lib/tauri-errors.ts
import { toast } from 'svelte-sonner';

export function handleTauriError(error: unknown) {
    if (error instanceof Error) {
        if (error.message.includes('AllServersFailed')) {
            toast.error('All Tidal servers unavailable. Please try again later.');
        } else if (error.message.includes('RateLimited')) {
            toast.warning('Too many requests. Please wait a moment.');
        } else {
            toast.error(`Error: ${error.message}`);
        }
    }
}
```

---

## 6. Migration Checklist

### Phase 1: Tauri Setup (2 hours)
- [ ] Install Rust toolchain (`rustup`)
- [ ] Install Tauri CLI: `cargo install tauri-cli`
- [ ] Initialize Tauri in project: `cargo tauri init`
- [ ] Install plugins:
  ```bash
  cargo add tauri-plugin-http
  cargo add tauri-plugin-fs
  cargo add tauri-plugin-shell
  cargo add tauri-plugin-store
  ```
- [ ] Configure `tauri.conf.json`:
  - App name: "MusicMachine"
  - Window title: "MusicMachine - Lossless Streaming"
  - Window size: 1280x800
  - Permissions: http, fs, shell

### Phase 2: SvelteKit Configuration (1 hour)
- [ ] Switch to `@sveltejs/adapter-static`:
  ```bash
  npm install -D @sveltejs/adapter-static
  ```
- [ ] Update `svelte.config.js`:
  ```javascript
  import adapter from '@sveltejs/adapter-static';
  
  export default {
      kit: {
          adapter: adapter({
              pages: 'build',
              assets: 'build',
              fallback: 'index.html'
          })
      }
  };
  ```
- [ ] Update `vite.config.ts`:
  ```typescript
  export default defineConfig({
      plugins: [sveltekit()],
      clearScreen: false,
      server: {
          port: 1420,
          strictPort: true,
          watch: {
              ignored: ['**/src-tauri/**']
          }
      }
  });
  ```

### Phase 3: HTTP Client Refactoring (6-8 hours)

#### 3.1 Rust Backend
- [ ] Create `src-tauri/src/http_client.rs`
- [ ] Implement `fetch_with_retry()`
- [ ] Implement server selection logic
- [ ] Add Tauri commands:
  - `select_tidal_server`
  - `fetch_tidal_api`
  - `fetch_stream_url`

#### 3.2 Frontend
- [ ] Create `src/lib/tauri-http.ts`
- [ ] Refactor `src/lib/api.ts`:
  - Replace `fetchWithCORS()` calls with `tauriRequest()`
  - Remove proxy URL wrapping
  - Update error handling
- [ ] Update `src/lib/config.ts`:
  - Keep server list
  - Remove `useProxy` and `proxyUrl`
  - Export for Rust backend

#### 3.3 Testing
- [ ] Test search functionality
- [ ] Test track streaming (LOSSLESS quality)
- [ ] Test Hi-Res streaming (DASH manifests)
- [ ] Test album/artist/playlist loading
- [ ] Verify error handling and retries

### Phase 4: Download System (4-6 hours)

#### 4.1 Rust Backend
- [ ] Create `src-tauri/src/downloads.rs`
- [ ] Implement `download_track()` command
- [ ] Implement `embed_metadata()` command
- [ ] Add progress tracking:
  ```rust
  #[tauri::command]
  async fn download_track_with_progress(
      window: Window,
      track_id: String,
      quality: String
  ) -> Result<String> {
      // Emit progress events
      window.emit("download-progress", DownloadProgress {
          track_id: track_id.clone(),
          bytes_downloaded: current,
          total_bytes: total
      })?;
  }
  ```

#### 4.2 Frontend
- [ ] Create `src/lib/downloads-tauri.ts`
- [ ] Refactor `src/lib/downloads.ts`:
  - Replace browser downloads with Tauri commands
  - Add progress listeners
  - Update UI components
- [ ] Update download UI:
  - Show native progress
  - Display file paths
  - Add "Open in Folder" button

#### 4.3 Testing
- [ ] Test single track download
- [ ] Test album download
- [ ] Test metadata embedding
- [ ] Verify file locations
- [ ] Test cancel/retry

### Phase 5: Cleanup (1 hour)
- [ ] Delete `src/routes/api/` directory
- [ ] Remove unused dependencies:
  ```bash
  npm uninstall @sveltejs/adapter-auto ioredis
  ```
- [ ] Update `.gitignore`:
  ```
  /src-tauri/target
  /src-tauri/WixTools
  ```
- [ ] Clean up `package.json` scripts:
  ```json
  {
      "scripts": {
          "tauri": "tauri",
          "dev": "tauri dev",
          "build": "tauri build"
      }
  }
  ```

### Phase 6: Native Features (Optional, 2-4 hours)

#### 6.1 System Tray
- [ ] Create tray icon (PNG, 32x32)
- [ ] Implement tray menu:
  ```rust
  use tauri::Manager;
  use tauri::menu::{Menu, MenuItem};
  use tauri::tray::TrayIconBuilder;
  
  fn create_tray(app: &AppHandle) -> Result<()> {
      let quit = MenuItem::new(app, "Quit", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&quit])?;
      
      TrayIconBuilder::new()
          .menu(&menu)
          .icon(app.default_window_icon().unwrap().clone())
          .build(app)?;
      
      Ok(())
  }
  ```

#### 6.2 Media Keys
- [ ] Already implemented via `navigator.mediaSession`
- [ ] Test with hardware keys (Play/Pause/Next/Prev)

#### 6.3 Notifications
- [ ] Use `tauri-plugin-notification`:
  ```rust
  use tauri_plugin_notification::NotificationExt;
  
  app.notification()
      .builder()
      .title("Now Playing")
      .body(&format!("{} - {}", track.title, track.artist))
      .show()?;
  ```

### Phase 7: Testing & Polish (4-6 hours)
- [ ] End-to-end testing:
  - [ ] Search and play tracks
  - [ ] Download albums
  - [ ] Scrobble to Last.fm
  - [ ] Test all quality settings
- [ ] Performance testing:
  - [ ] Memory usage (should be <200MB)
  - [ ] Startup time
  - [ ] Streaming latency
- [ ] Cross-platform testing:
  - [ ] Windows 10/11
  - [ ] macOS (if available)
  - [ ] Linux (Ubuntu/Fedora)
- [ ] Build & package:
  ```bash
  cargo tauri build
  ```
- [ ] Test installers:
  - Windows: `.msi` and `.exe`
  - macOS: `.dmg` and `.app`
  - Linux: `.deb`, `.AppImage`

---

## 7. Environment Variables

### Current (`.env`)
```
VITE_LASTFM_API_KEY=6978ef537dc0dad223937d3e43c3244c
VITE_LASTFM_SHARED_SECRET=968b6dfb8ffe6e82132dc308e61b2e84
```

### Tauri (Build-time)
**Option 1: Keep in `.env` (less secure)**
- Vite will inline at build time
- Visible in bundle

**Option 2: Move to Rust (more secure)**
```rust
// src-tauri/src/secrets.rs
pub const LASTFM_API_KEY: &str = "6978ef537dc0dad223937d3e43c3244c";
pub const LASTFM_SHARED_SECRET: &str = "968b6dfb8ffe6e82132dc308e61b2e84";
```

**Recommendation:** Keep in `.env` for development, move to Rust for production builds.

---

## 8. Performance Benchmarks

### Expected Improvements
| Metric | Web App | Tauri App | Improvement |
|--------|---------|-----------|-------------|
| Bundle Size | N/A | 15-20MB | Smaller than Electron (150MB+) |
| Memory Usage | 200-300MB | 100-150MB | 50% reduction |
| Startup Time | 2-3s | 1-2s | Faster |
| Download Speed | Browser throttle | Native | 2-3x faster |
| Streaming Latency | +CORS overhead | Direct | Lower |

---

## 9. Risks & Mitigations

### Risk 1: Tidal Servers Block Tauri User-Agent
**Likelihood:** Medium  
**Impact:** High  
**Mitigation:**
- Use same User-Agent as browser (`Mozilla/5.0...`)
- Implement fallback to Rust proxy if direct fails
- Rotate User-Agents if needed

### Risk 2: Hi-Res DASH Playback Issues
**Likelihood:** Low  
**Impact:** Medium  
**Mitigation:**
- Test with Shaka Player in Tauri WebView
- Keep existing FLAC fallback logic
- Monitor for WebView-specific issues

### Risk 3: Cross-Platform Bugs
**Likelihood:** Medium  
**Impact:** Medium  
**Mitigation:**
- Test on all 3 platforms early
- Use platform-specific code sparingly
- Leverage Tauri's abstractions

### Risk 4: Build Complexity
**Likelihood:** Low  
**Impact:** Low  
**Mitigation:**
- Follow Tauri docs carefully
- Set up CI/CD for automated builds
- Document build process

---

## 10. Post-Migration Roadmap

### Short-term (1-2 weeks)
- [ ] Auto-updater implementation (`tauri-plugin-updater`)
- [ ] Crash reporting (Sentry integration)
- [ ] Usage analytics (opt-in)

### Medium-term (1-2 months)
- [ ] Keyboard shortcuts (global hotkeys)
- [ ] Discord Rich Presence
- [ ] Playlist export/import
- [ ] Equalizer/audio effects

### Long-term (3+ months)
- [ ] Mobile app (Tauri Mobile support)
- [ ] Cloud sync (playlists, settings)
- [ ] Social features (share tracks)
- [ ] Plugin system (extensibility)

---

## 11. Success Criteria

### Must-Have
- ✅ All current features work (search, play, download, Last.fm)
- ✅ Downloads save to Music folder without prompts
- ✅ No CORS errors
- ✅ <20MB bundle size
- ✅ <200MB memory usage
- ✅ Installs on Windows/Mac/Linux

### Nice-to-Have
- ✅ System tray integration
- ✅ Native notifications
- ✅ Auto-updates
- ✅ <15MB bundle size
- ✅ <150MB memory usage

### Dealbreakers
- ❌ Worse streaming quality than web app
- ❌ Slower performance
- ❌ Cannot download files
- ❌ Last.fm scrobbling broken

---

## 12. Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Setup | 2 hours | None |
| Configuration | 1 hour | Setup |
| HTTP Refactoring | 8 hours | Configuration |
| Download System | 6 hours | HTTP Refactoring |
| Cleanup | 1 hour | Download System |
| Native Features | 4 hours | Cleanup |
| Testing & Polish | 6 hours | All above |
| **Total** | **28 hours** | - |

**Realistic timeline:** 4-5 days of focused work, or 2 weeks part-time.

---

## 13. Questions to Resolve Before Starting

1. **Spotify Integration:** Keep Spotify playlist converter or remove?
2. **Songlink Integration:** Still needed or can be removed?
3. **Redis Dependency:** Is Redis server running locally? (affects caching strategy)
4. **Target Platforms:** Windows-only first, or all 3 platforms from start?
5. **Distribution:** Self-hosted updates or app store submission?
6. **Branding:** Stick with "MusicMachine" or rebrand?

---

## Next Steps

1. **Review this plan** - Confirm architecture decisions
2. **Answer questions** - Resolve open items
3. **Set up dev environment** - Install Rust, Tauri CLI
4. **Start Phase 1** - Create Tauri project structure
5. **Iterate** - Build, test, refine

Ready to proceed? 🚀
