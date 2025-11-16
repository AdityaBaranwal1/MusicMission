# MusicMachine Setup Guide

## Architecture - Built-in Shared Token System!

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────┐
│  SvelteKit UI   │ ───► │  Public Proxy Cluster│ ───► │ Tidal API   │
│  (Port 5173)    │      │  (20+ servers)       │      │             │
│  tidal-ui-main  │      │  Built-in auth!      │      │ Token Auth  │
└─────────────────┘      └──────────────────────┘      └─────────────┘
```

**Frontend (SvelteKit - tidal-ui-main):**
- Complete standalone music streaming UI
- **Built-in shared token system** - no backend needed!
- Automatically rotates between 20+ proxy servers
- All servers have pre-configured Tidal tokens
- Runs on port 5173

**Proxy Servers (Built-in):**
- kraken.squid.wtf, triton.squid.wtf, zeus.squid.wtf
- phoenix.squid.wtf, shiva.squid.wtf, chaos.squid.wtf
- monochrome.tf (10 regions: California, London, Singapore, Tokyo, etc.)
- qqdl.site (5 servers: hund, katze, maus, vogel, wolf)
- Automatic failover and load balancing

## Prerequisites

**Just Node.js!**
- **Node.js** (v20+) - https://nodejs.org/
- ~~No Go backend needed~~
- ~~No Tidal API credentials needed~~

## Installation

**Super Simple - Just Install Frontend:**

```bash
cd tidal-ui-main
npm install
```

## Running the Application

### One-Click Launcher (Recommended)

```bash
start-musicmachine.bat
```

This starts:
1. SvelteKit frontend (port 5173)
2. Browser window

### Manual Start

```bash
cd tidal-ui-main
npm run dev
```

Then open http://localhost:5173

## How Built-in Token System Works

**Zero Configuration Required!**

1. **Frontend makes request** → UI calls search/stream/etc.
2. **Automatic server selection** → Picks from 20+ proxy servers (weighted random)
3. **Proxy handles auth** → Server injects pre-configured Tidal token
4. **Automatic failover** → If server fails, tries next server automatically
5. **Load balancing** → Distributes requests across healthy servers

**Token Flow:**
```
Your Browser
    ↓
SvelteKit UI (localhost:5173)
    ↓
Automatic Server Selection (config.ts)
    ↓
Public Proxy Server (e.g., kraken.squid.wtf)
    ↓
[Proxy adds: Authorization: Bearer {shared_token}]
    ↓
Tidal API
```

**Server Health:**
- Tries up to 3 servers per request
- Automatically skips failed/slow servers
- Uses weighted random selection for load balancing
- Prefers certain servers for specific operations (albums, playlists)

## Proxy Server Clusters

**All Built-in - No Setup Required:**

### squid.wtf (Primary Cluster)
- kraken.squid.wtf (weight: 20)
- triton.squid.wtf (weight: 20)
- zeus.squid.wtf (weight: 19)
- aether.squid.wtf (weight: 19)
- phoenix.squid.wtf (weight: 20)
- shiva.squid.wtf (weight: 20)
- chaos.squid.wtf (weight: 20)

### monochrome.tf (Global Regions)
- california.monochrome.tf
- london.monochrome.tf
- singapore.monochrome.tf
- tokyo.monochrome.tf
- frankfurt.monochrome.tf
- virginia.monochrome.tf
- oregon.monochrome.tf
- ohio.monochrome.tf
- jakarta.monochrome.tf

### qqdl.site (US Cluster)
- hund.qqdl.site
- katze.qqdl.site
- maus.qqdl.site
- vogel.qqdl.site
- wolf.qqdl.site

## Troubleshooting

### Frontend won't start
**Error:** "npm install failed" or dependency errors
- **Fix:** Delete `node_modules` and `package-lock.json`, run `npm install` again
- **Fix:** Ensure Node.js v20+ is installed

### All servers failing
**Error:** "All API targets failed without response"
- **Fix:** Check internet connection
- **Fix:** Try different network (some ISPs/VPNs may block proxy domains)
- **Fix:** Proxy servers may be temporarily down - wait 5-10 minutes

### Slow loading
**Error:** Music takes long to load
- **Fix:** Normal - frontend tries multiple servers automatically
- **Fix:** First server might be slow/down, it will rotate to faster ones
- **Fix:** Close and reopen browser to reset connection pool

### Port conflicts
**Error:** "Port 5173 already in use"
- **Fix:** Kill process: `npx kill-port 5173`
- **Fix:** Or change port in `vite.config.ts`

## Development

### Frontend Development
```bash
cd tidal-ui-main
npm run dev
```

### Build for Production

```bash
cd tidal-ui-main
npm run build
npm run preview
```

### Customizing Proxy Servers

Edit `tidal-ui-main/src/lib/config.ts` to:
- Add/remove proxy servers
- Change server weights (higher = more requests)
- Set region preferences (auto/us/eu)

## File Structure

```
MusicMachine/
├── start-musicmachine.bat        # One-click launcher
├── SETUP.md                      # This file
├── hifi-main/                    # (Optional) Go backend - not needed!
└── tidal-ui-main/                # SvelteKit frontend - ONLY NEEDED
    ├── package.json              # Node dependencies
    ├── vite.config.ts            # Vite config
    ├── src/
    │   ├── routes/               # Pages
    │   ├── lib/
    │   │   ├── config.ts         # ⭐ Proxy server config
    │   │   ├── api.ts            # API client with auto-failover
    │   │   ├── components/       # UI components
    │   │   ├── stores/           # State management
    │   │   └── types/            # TypeScript types
    │   └── app.html              # HTML template
    └── static/                   # Static assets
```

## Next Steps

1. ✅ Run `cd tidal-ui-main && npm install`
2. ✅ Execute `start-musicmachine.bat`
3. ✅ Open http://localhost:5173 in browser
4. 🎵 Enjoy lossless music streaming - **zero configuration!**

---

**Last Updated:** November 16, 2025
**Status:** Ready to use - built-in shared token system (20+ proxy servers)
**Supported:** Windows, macOS, Linux
**No Backend Required:** Frontend has built-in authentication through public proxies
**No API Keys Required:** All tokens managed by proxy servers
