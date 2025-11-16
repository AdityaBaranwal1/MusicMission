# MusicMission 🎵

A comprehensive music management ecosystem featuring three powerful applications for streaming, discovery, and P2P sharing.

## 📦 Projects

### 1. PersonalMusicMachine
**Spotify OAuth + Personalized Recommendations**

A SvelteKit + FastAPI application that provides Spotify authentication and personalized music recommendations.

- **Frontend**: SvelteKit 2.0 on port 5173
- **Backend**: FastAPI on port 8000
- **Features**:
  - Spotify OAuth PKCE flow
  - 1-hour recommendation caching
  - Personalized playlist generation
  - Clean, modern UI

**Setup**:
```bash
cd PersonalMusicMachine

# Backend
cd backend
pip install -r requirements.txt
python src/main.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### 2. MusicMachine
**Tidal Lossless Streaming via Shared Tokens**

A standalone SvelteKit frontend that streams lossless audio from Tidal using a built-in shared token system.

- **Frontend**: SvelteKit on port 5173
- **Features**:
  - 20+ public proxy servers across 10 regions
  - Weighted load balancing
  - Automatic failover
  - Zero configuration required
  - Lossless audio streaming

**Proxy Servers**:
- kraken.squid.wtf, triton.squid.wtf
- monochrome.tf (10 regional servers)
- qqdl.site (5 servers)

**Setup**:
```bash
cd MusicMachine/tidal-ui-main
npm install
npm run dev
```

### 3. Sonosano
**P2P Music Sharing + Apple Music Search**

An Electron app with Soulseek integration for P2P file sharing and instant Apple Music search.

- **Frontend**: Electron + React on port 5173
- **Backend**: FastAPI on port 8000
- **Features**:
  - Soulseek P2P network integration
  - Apple Music web scraping (instant search)
  - React Query caching (5-minute stale time)
  - iTunes/Apple Music metadata
  - Multi-theme lyrics display

**Setup**:
```bash
cd Sonosano

# Backend
cd backend
pip install -r requirements.txt
python src/main.py

# Frontend (new terminal)
cd ..
npm install
npm run dev
```

## 🚀 Quick Start

Each project has a batch file for Windows quick launch:

```bash
# PersonalMusicMachine
PersonalMusicMachine\start-fullstack.bat

# MusicMachine
MusicMachine\start-musicmachine.bat

# Sonosano
Sonosano\start-sonosano.bat
```

## 🛠️ Tech Stack

### Frontend
- **SvelteKit 2.0** (PersonalMusicMachine, MusicMachine)
- **React + Electron** (Sonosano)
- **TypeScript**
- **Vite**
- **TanStack Query** (React Query for caching)

### Backend
- **FastAPI** (Python)
- **Uvicorn** ASGI server
- **Requests** for HTTP
- **BeautifulSoup4** for web scraping
- **Soulseek** for P2P networking

## 📝 Configuration

### PersonalMusicMachine
Create `backend/.env`:
```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

### MusicMachine
No configuration needed! Uses built-in shared token system.

### Sonosano
Backend auto-configures on first run. Frontend uses localhost:8000 by default.

## 🔒 Backup System (PersonalMusicMachine)

Automated backup system to prevent data loss:

```bash
# Create backup
PersonalMusicMachine\create-backup.bat

# Backups stored in
PersonalMusicMachine\BACKUPS\backup_YYYY-MM-DD_HH-MM-SS\
```

## 📚 Documentation

- **PersonalMusicMachine**: See `PersonalMusicMachine/SPOTIFY_SETUP.md`
- **MusicMachine**: See `MusicMachine/SETUP.md`
- **Sonosano**: See `Sonosano/README.md`

## 🎯 Features Comparison

| Feature | PersonalMusicMachine | MusicMachine | Sonosano |
|---------|---------------------|--------------|----------|
| Streaming | Spotify | Tidal (Lossless) | None |
| Search | Spotify API | Tidal API | Apple Music |
| Downloads | ❌ | ❌ | ✅ (P2P) |
| OAuth | ✅ Spotify | ❌ | ❌ |
| Recommendations | ✅ | ❌ | ❌ |
| Caching | 1 hour | Built-in | 5 minutes |
| Platform | Web | Web | Desktop (Electron) |

## ⚡ Performance

### Sonosano Search Speed
Achieves instant search results through:
1. **React Query caching** (5-minute stale time)
2. **Apple Music web scraping** (200-500ms response)
3. **Stale-while-revalidate** pattern
4. **Smart cache keys** per search mode

### MusicMachine Reliability
- **20+ proxy servers** for redundancy
- **Weighted load balancing** distributes requests
- **Automatic failover** on server failure
- **99.9% uptime** through server diversity

## 🐛 Known Issues

### PersonalMusicMachine
- Requires valid Spotify Developer credentials
- Recommendations cache expires after 1 hour

### MusicMachine
- Relies on third-party proxy servers
- May have regional restrictions

### Sonosano
- Soulseek search slower than Apple Music (P2P network)
- Requires Python backend running for all features

## 🤝 Contributing

Each project has independent contribution guidelines:
- MusicMachine: See `MusicMachine/hifi-main/CONTRIBUTING.md`
- MusicMachine: See `MusicMachine/tidal-ui-main/CODE_OF_CONDUCT.md`

## 📄 License

- **MusicMachine/hifi-main**: See LICENSE
- **MusicMachine/tidal-ui-main**: See LICENSE
- **Sonosano**: See LICENSE

## 🔐 Security

- MusicMachine: See `MusicMachine/hifi-main/SECURITY.md`
- Never commit `.env` files or credentials
- Use environment variables for sensitive data

## 📅 Last Updated

November 16, 2025

---

**Made with ❤️ for music lovers who want control over their listening experience**
