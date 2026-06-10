/**
 * Multi-Embed Scrapers for ARVIO
 * 
 * This repository contains scrapers for ARVIO that work with the embed services
 * used by popular streaming aggregation sites.
 * 
 * Supported Sites:
 * - cineby.at      → vidking.net
 * - bcine.ru       → 1embed.cc
 * - flixer.su      → various embed services
 * - flickystream.su → various embed services
 * - rivestream.app  → IPTV + embed
 * - cinevibe.asia  → Cloudflare protected
 * - popcornmovies.org → Cloudflare protected
 * 
 * Embed Services Covered:
 * 1. Vidking (vidking.net) - Primary for cineby.at
 * 2. 1embed.cc - Primary for bcine.ru
 * 3. 2embed.cc
 * 4. Vidlink (vidlink.org)
 * 5. Vidsrc (vidsrc.me)
 * 6. Embed.su (embed.su)
 * 7. Multiembed (multiembed.mov)
 * 
 * Usage:
 * 
 * Option 1: JS Scrapers (Easiest - no build required)
 * ---------------------------------------------------
 * 1. Host the .js files on GitHub Pages or any HTTPS server
 * 2. Create a manifest.json (see manifest.json)
 * 3. In ARVIO: Settings → Plugins → Add Repository → paste manifest URL
 * 4. Enable "MultiEmbed Aggregator" or individual scrapers
 * 
 * Option 2: DEX Extensions (CloudStream format - more powerful)
 * -------------------------------------------------------------
 * 1. Create an Android library module in ARVIO
 * 2. Add MultiEmbedPlugin.kt to the module
 * 3. Build: ./gradlew :extension:assembleRelease
 * 4. Rename output .apk to .cs3
 * 5. Host .cs3 file and add to plugins.json
 * 
 * How It Works:
 * 
 * These scrapers use TMDB IDs directly. The embed services accept URLs like:
 * - Movie: https://vidking.net/embed/movie/{tmdbId}
 * - TV: https://vidking.net/embed/tv/{tmdbId}/{season}/{episode}
 * 
 * They return HTML pages with embedded players. The scrapers parse the HTML
 * (and sometimes base64-encoded JavaScript) to extract direct m3u8/mp4 URLs.
 * 
 * The MultiEmbed aggregator tries services in priority order and returns
 * sources from the first working service.
 * 
 * Installation in ARVIO:
 * 
 * 1. Open ARVIO
 * 2. Go to Settings → Plugins
 * 3. Tap "Add Repository"
 * 4. Enter: https://your-domain.com/plugins.json
 * 5. Enable desired scrapers
 * 6. Done! Scrapers will appear in the Plugins screen
 * 
 * Repository Structure:
 * 
 * /scrapers/
 *   ├── vidking_scraper.js      # Vidking embed scraper (JS)
 *   ├── 1embed_scraper.js       # 1embed.cc scraper (JS)
 *   ├── multiembed_scraper.js   # Multi-service aggregator (JS)
 *   ├── manifest.json           # Individual plugin manifest
 *   ├── plugins.json            # Repository plugin list
 *   ├── MultiEmbedPlugin.kt     # Kotlin/DEX extension template
 *   └── README.md               # This file
 * 
 * Adding Custom Embed Services:
 * 
 * To add a new embed service to MultiEmbedScraper:
 * 
 * 1. Add to services array:
 *    {
 *      name: "NewService",
 *      domain: "newservice.com",
 *      moviePattern: "https://newservice.com/embed/movie/{id}",
 *      tvPattern: "https://newservice.com/embed/tv/{id}/{season}/{episode}",
 *      priority: 8
 *    }
 * 
 * 2. Test with a known TMDB ID
 * 3. Adjust parsing logic if needed (some services use different JS patterns)
 * 
 * Known Issues:
 * 
 * - Some sites use Cloudflare (cinevibe.asia, popcornmovies.org) - scrapers won't work directly
 * - Embed services may change their HTML/JS structure over time
 * - Some services require cookies/referrer headers
 * - Rate limiting may occur with heavy usage
 * 
 * Contributing:
 * 
 * PRs welcome! Please:
 * 1. Test with multiple TMDB IDs (movies + TV)
 * 2. Handle errors gracefully
 * 3. Add appropriate delays/retries
 * 4. Update the plugin list
 * 
 * License: Apache 2.0 (same as ARVIO)
 */