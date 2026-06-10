# Manual GitHub Push (if no gh CLI)

## Option 1: With gh CLI (Easiest)
```bash
# 1. Install gh: https://cli.github.com/
# 2. Authenticate:
gh auth login

# 3. Run the deploy script:
cd /root/ARVIO/scrapers
chmod +x deploy_to_github.sh
./deploy_to_github.sh
```

## Option 2: Pure Git (No gh CLI)

```bash
# 1. Go to GitHub.com → New Repository
#    Name: ARVIO-scrapers
#    Public ✓
#    NO README, .gitignore, license

# 2. Copy the repo URL (e.g. https://github.com/YOURUSER/ARVIO-scrapers.git)

# 3. Run these commands:
cd /root/ARVIO/scrapers

# If you already have a local git repo (we do):
git remote add origin https://github.com/YOURUSER/ARVIO-scrapers.git
git push -u origin master

# 4. Enable GitHub Pages:
# Go to: https://github.com/YOURUSER/ARVIO-scrapers/settings/pages
# Source: "Deploy from a branch"
# Branch: master / (root)
# Save

# 5. Your manifest URL (appears in ~1 min):
# https://YOURUSER.github.io/ARVIO-scrapers/plugins.json
```

## Option 3: SSH (If you have SSH keys on GitHub)

```bash
cd /root/ARVIO/scrapers
git remote add origin git@github.com:YOURUSER/ARVIO-scrapers.git
git push -u origin master
# Then enable Pages in settings
```

---

## What you get after deploy:

**Manifest URL (add to ARVIO):**
```
https://YOURUSER.github.io/ARVIO-scrapers/plugins.json
```

**Individual scraper URLs:**
```
https://YOURUSER.github.io/ARVIO-scrapers/multiembed_scraper.js
https://YOURUSER.github.io/ARVIO-scrapers/vidking_scraper.js
https://YOURUSER.github.io/ARVIO-scrapers/1embed_scraper.js
```

---

## Files ready at `/root/ARVIO/scrapers/`:
```
plugins.json           ← Main manifest (add this to ARVIO)
multiembed_scraper.js  ← Aggregator (7 embed services)
vidking_scraper.js     ← Vidking.net → cineby.at
1embed_scraper.js      ← 1embed.cc   → bcine.ru
MultiEmbedPlugin.kt    ← DEX extension template
README.md              ← Documentation
```