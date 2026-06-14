# AniStash - Your Personal Anime & Manga Library

A modern, privacy-focused anime and manga tracking application built on Cloudflare's edge platform. Track your watchlist, reading list, and discover new series with AI-powered bookmark import.

##  Features

- **Smart Bookmark Import** - Paste any anime/manga URL and let AI identify and add it to your library
- **Personal Library** - Track anime and manga with status (Watching, Completed, Planning, On-Hold, Dropped)
- **Progress Tracking** - Keep count of episodes watched or chapters read
- **AniList Integration** - Automatic metadata fetching from AniList's comprehensive database
- **AI-Powered Notes** - Optional Gemini AI integration for enhanced series information
- **Privacy First** - Your data stays with you, encrypted API keys, no tracking

##  Getting Started

### 1. Create an Account

1. Visit the app and click "Sign Up"
2. Enter your email and create a password
3. Start building your library!

### 2. Configure AI Features (Optional)

**Option A: Use Gemini AI**
1. Go to Settings
2. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
3. Paste your key and select your preferred model
4. Your key is encrypted and stored securely

**Option B: Skip AI**
- The app works perfectly without AI
- Manual entry and AniList data are always available

### 3. Add Series to Your Library

**Method 1: Smart URL Import**
- Paste any anime/manga URL (AniList, MyAnimeList, etc.)
- AI identifies the series and adds it automatically
- Set your status and start tracking

**Method 2: Manual Search**
- Search by title
- Select from AniList results
- Add to your library

### 4. Quick Tips

- **Status Tabs:** Filter your library by Watching, Completed, Planning, On-Hold, or Dropped
- **Progress Updates:** Click any card to update episode/chapter progress
- **Personal Notes:** Add notes to remember why you loved (or dropped) a series
- **Export Ready:** Your data is stored in a standard SQLite database

##  Install as App

AniStash is a Progressive Web App (PWA) - install it for a native app experience!

**On Desktop:**
- Look for the install icon in your browser's address bar
- Click to add to your desktop/dock

**On Mobile:**
- Tap your browser's menu
- Select "Add to Home Screen" or "Install App"

##  Security & Privacy

- **Encrypted API Keys:** Your Gemini key is encrypted at rest using AES-GCM
- **Edge Computing:** Runs on Cloudflare Workers for speed and security
- **No Tracking:** Your viewing habits stay private
- **Self-Hostable:** Run your own instance with full control

##  Use Cases

- **Anime Enthusiasts:** Track seasonal anime and never forget what episode you're on
- **Manga Readers:** Keep your reading list organized across multiple sites
- **Completionists:** Maintain a comprehensive history of everything you've watched/read

##  Need Help?

**Can't find a series?**
- Try the full AniList title (check anilist.co)
- Some obscure titles may not be in the database yet

**Import not working?**
- Check your Gemini API key in Settings
- Make sure the URL is from a supported site (AniList, MAL, etc.)

---

##  For Developers

Want to run your own instance or contribute?

### Tech Stack

- **Frontend:** React 19, TanStack Router, TanStack Query, Tailwind CSS 4
- **Backend:** Cloudflare Workers, h3, TanStack Start
- **Database:** Cloudflare D1 (SQLite)
- **APIs:** AniList GraphQL API, Google Gemini AI

### Quick Setup

```bash
npm install
npm run dev
```

### Database Setup

1. Create your D1 database:
```bash
npx wrangler d1 create anistash
```

2. Update `wrangler.toml` with your database ID:
```toml
[[d1_databases]]
binding = "DB"
database_name = "anistash"
database_id = "your-database-id-here"
```

3. Push the schema:
```bash
npx wrangler d1 execute anistash --file=./schema.d1.sql --local
```

### Deploy to Cloudflare

**Via GitHub:**
1. Fork this repository
2. Connect to Cloudflare Pages
3. Configure D1 binding in Pages settings

**Direct Deploy:**
```bash
npm run build
npx wrangler pages deploy dist/client --project-name=anistash
```

### Environment Variables

Optional configuration for development:

`.dev.vars`:
```
ALLOW_SIGNUP=true
ENCRYPTION_KEY=your-32-byte-encryption-key-here
```

### Database Management

```bash
# View local data
npx wrangler d1 execute anistash --command="SELECT * FROM users" --local

# View remote data
npx wrangler d1 execute anistash --command="SELECT * FROM users" --remote

# Backup
npx wrangler d1 export anistash --output=backup.sql --remote
```

### Project Structure

```
src/
  components/         # React UI components
    ui/              # shadcn/ui components
  lib/
    api/             # API client functions
    repo/            # Database repository layer
    anilist-client.ts    # AniList GraphQL client
    auth.ts          # Authentication logic
    crypto.ts        # Encryption utilities
    db.ts            # D1 database client
  routes/            # TanStack Router pages
  server.ts          # Cloudflare Workers entry point
```

---

**Built with ❤️ for anime and manga fans**

[Report an Issue](https://github.com/yourusername/anistash/issues) • [Request a Feature](https://github.com/yourusername/anistash/issues/new)
