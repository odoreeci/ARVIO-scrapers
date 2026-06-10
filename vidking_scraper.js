/**
 * Vidking Embed Scraper for ARVIO
 * Target: vidking.net embed player (used by cineby.at, etc.)
 * 
 * This scraper fetches sources from Vidking's embed API.
 * Vidking uses TMDB IDs and provides direct stream URLs.
 */

class VidkingScraper {
    constructor() {
        this.name = "Vidking";
        this.baseUrl = "https://www.vidking.net";
        this.supportedTypes = ["movie", "tv"];
        this.version = "1.0";
    }

    async loadLinks(info) {
        const { id, type, season, episode } = info;
        
        if (!id) {
            console.warn("Vidking: No TMDB ID provided");
            return [];
        }

        try {
            const embedUrl = type === "movie" 
                ? `${this.baseUrl}/embed/movie/${id}`
                : `${this.baseUrl}/embed/tv/${id}/${season}/${episode}`;

            console.log(`Vidking: Fetching ${embedUrl}`);

            const response = await fetch(embedUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
                    "Referer": this.baseUrl
                }
            });

            if (!response.ok) {
                console.warn(`Vidking: HTTP ${response.status}`);
                return [];
            }

            const html = await response.text();
            return this.parseSources(html, id, type);
        } catch (error) {
            console.error("Vidking: Error fetching sources:", error);
            return [];
        }
    }

    parseSources(html, tmdbId, type) {
        const sources = [];

        // Vidking loads sources via JavaScript - check for embedded JSON data
        const patterns = [
            // Pattern 1: JSON data in script tags
            /sources\s*[:=]\s*(\[[\s\S]*?\])/gi,
            /sources\s*[:=]\s*(\{[\s\S]*?\})/gi,
            // Pattern 2: m3u8 URLs directly
            /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi,
            // Pattern 3: mp4 URLs
            /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/gi,
            // Pattern 4: Vidking-specific player config
            /playerConfig\s*[:=]\s*(\{[\s\S]*?\})/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const str = match[1] || match[0];
                try {
                    // Try to parse as JSON
                    const data = JSON.parse(str);
                    if (Array.isArray(data)) {
                        this.extractFromArray(data, sources);
                    } else if (data.file || data.src || data.url) {
                        this.extractFromObject(data, sources);
                    }
                } catch (e) {
                    // Not JSON, might be direct URL
                    if (str.includes(".m3u8") || str.includes(".mp4")) {
                        sources.push({
                            url: str,
                            quality: this.detectQuality(str),
                            headers: { "Referer": this.baseUrl }
                        });
                    }
                }
            }
        }

        // Also check for data attributes in HTML
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
        if (iframeMatch) {
            for (const iframe of iframeMatch) {
                const srcMatch = iframe.match(/src=["']([^"']+)["']/i);
                if (srcMatch && (srcMatch[1].includes("vidking") || srcMatch[1].includes("m3u8"))) {
                    sources.push({
                        url: srcMatch[1],
                        quality: "auto",
                        headers: { "Referer": this.baseUrl }
                    });
                }
            }
        }

        // Deduplicate
        const unique = [];
        const seen = new Set();
        for (const s of sources) {
            if (!seen.has(s.url)) {
                seen.add(s.url);
                unique.push(s);
            }
        }

        console.log(`Vidking: Found ${unique.length} sources for TMDB ${tmdbId}`);
        return unique;
    }

    extractFromArray(data, sources) {
        for (const item of data) {
            this.extractFromObject(item, sources);
        }
    }

    extractFromObject(obj, sources) {
        const url = obj.file || obj.src || obj.url || obj.link;
        if (!url) return;

        const quality = obj.quality || obj.label || obj.res || this.detectQuality(url);
        const headers = obj.headers || { "Referer": this.baseUrl };

        sources.push({ url, quality, headers });
    }

    detectQuality(url) {
        if (/2160|4k|uhd/i.test(url)) return "4K";
        if (/1080|fullhd/i.test(url)) return "1080p";
        if (/720|hd/i.test(url)) return "720p";
        if (/480/i.test(url)) return "480p";
        return "auto";
    }
}

// Export for ARVIO PluginRuntime
if (typeof module !== "undefined" && module.exports) {
    module.exports = VidkingScraper;
} else if (typeof window !== "undefined") {
    window.VidkingScraper = VidkingScraper;
}

// ARVIO Plugin interface
class VidkingPlugin {
    constructor() {
        this.scraper = new VidkingScraper();
    }

    async load(context) {
        // Called when plugin is loaded
        console.log("Vidking Plugin loaded");
    }

    async loadLinks(data) {
        // data contains: { id, type, season, episode }
        return await this.scraper.loadLinks(data);
    }

    getRegisteredMainAPIs() {
        return [];
    }

    getRegisteredExtractorAPIs() {
        return [
            {
                name: "Vidking",
                mainUrl: "https://www.vidking.net",
                getExtractUrl: async (url, type) => {
                    // For extractor API (direct stream extraction)
                    return url; // Pass through
                }
            }
        ];
    }
}

// Export plugin instance
if (typeof module !== "undefined" && module.exports) {
    module.exports = { VidkingScraper, VidkingPlugin };
} else if (typeof window !== "undefined") {
    window.VidkingPlugin = VidkingPlugin;
}