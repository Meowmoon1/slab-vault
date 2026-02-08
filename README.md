# ◆ Slab Vault — Pokémon Slab Flipper

A 100% local PWA for tracking Pokémon slab flips, portfolio analytics, and profit/loss.
Zero server dependency — all data lives in your browser's localStorage.

---

## Quick Start (Local Dev)

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev

# 3. Open http://localhost:5173
```

---

## Deploy to Your Phone (GitHub Pages — FREE)

### Step 1: Create GitHub Repo

```bash
# In this project folder:
git init
git add .
git commit -m "Initial commit — Slab Vault"

# Create a new repo on github.com (e.g. "slab-vault"), then:
git remote add origin https://github.com/YOUR_USERNAME/slab-vault.git
git branch -M main
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repo on GitHub
2. **Settings** → **Pages**
3. Under "Build and deployment", set Source to **GitHub Actions**
4. The included `.github/workflows/deploy.yml` will auto-deploy on push

### Step 3: Update Base Path (IMPORTANT)

If your repo is named `slab-vault`, uncomment this line in `vite.config.js`:

```js
base: "/slab-vault/",
```

Then push the change:
```bash
git add . && git commit -m "Set base path" && git push
```

### Step 4: Install on Phone

1. Wait ~2 minutes for GitHub Actions to finish
2. Visit `https://YOUR_USERNAME.github.io/slab-vault/`
3. **iOS**: Tap Share → "Add to Home Screen"
4. **Android**: Tap the browser menu → "Install app" or "Add to Home Screen"

You now have a native-feeling app icon on your phone! ✅

---

## Alternative: Deploy to Vercel (Even Easier)

1. Push to GitHub (steps above)
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. It auto-detects Vite — just click Deploy
5. Visit your `*.vercel.app` URL on your phone and add to home screen

With Vercel you don't need to set the `base` path.

---

## Alternative: Run Locally on Your Phone

If you're on the same WiFi:

```bash
npm run dev -- --host
```

This exposes the dev server on your local network. Open `http://YOUR_PC_IP:5173` on your phone.

---

## Features

- **Slab Database** — Full CRUD with card name, set, year, language, grading company, grade, cert number, population, images, notes, tags
- **Flip Tracking** — Buy/sell prices, platform fees, fixed fees, shipping, auto-calculated net profit, ROI, annualized return
- **Holding Period** — Days held per slab, avg hold time, capital velocity, weighted average by capital deployed, fastest flip
- **Portfolio Dashboard** — Total capital, realized/unrealized PnL, inventory value summary with winners & losers, breakdowns by grading company and era
- **Analytics** — Highest profit flips, best ROI, biggest losses, win rate, profit per day, monthly performance

---

## Tech Stack

- React 18 + Vite 6
- vite-plugin-pwa (offline support + installable)
- localStorage (all data persists locally)
- Zero external APIs or servers

---

## Data

All data is stored in your browser's `localStorage`. To back up:

1. Open browser DevTools → Application → Local Storage
2. Copy the `slabs` key value
3. Save it as a JSON file

To restore: paste the JSON back into the `slabs` key.
