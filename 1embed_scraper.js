/**
 * 1embed.cc Scraper for ARVIO
 * Target: 1embed.cc embed player (used by bcine.ru, etc.)
 */

class OneEmbedScraper {
    constructor() {
        this.name = "1embed";
        this.baseUrl = "https://1embed.cc";
        this.apiBase = "https://1embed.cc/api";
        this.supportedTypes = ["movie", "tv"];
        this.version = "1.0";
    }

    async loadLinks(info) {
        const { id, type, season, episode } = info;
        
        if (!id) {
            console.warn("1embed: No TMDB ID provided");
            return [];
        }

        try {
            // 1embed uses direct embed URLs
            const embedUrl = type === "movie" 
                ? `${this.baseUrl}/embed/movie/${id}`
                : `${this.baseUrl}/embed/tv/${id}/${season}/${episode}`;

            console.log(`1embed: Fetching ${embedUrl}`);

            const response = await fetch(embedUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
                    "Referer": this.baseUrl
                }
            });

            if (!response.ok) {
                console.warn(`1embed: HTTP ${response.status}`);
                return [];
            }

            const html = await response.text();
            return this.parseSources(html, id, type);
        } catch (error) {
            console.error("1embed: Error fetching sources:", error);
            return [];
        }
    }

    parseSources(html, tmdbId, type) {
        const sources = [];

        // 1embed patterns
        const patterns = [
            // JSON sources in page
            /sources\s*[:=]\s*(\[[\s\S]*?\])/gi,
            /playlist\s*[:=]\s*(\[[\s\S]*?\])/gi,
            // Direct m3u8/mp4
            /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi,
            /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/gi,
            // 1embed specific: eval(atob(...)) encoded
            /eval\(atob\(['"]([^'"]+)['"]\)\)/gi,
            // data-apere or similar attributes
            /data-(?:src|file|url)=["']([^"']+)["']/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const str = match[1] || match[0];
                
                // Handle base64 encoded
                if (pattern.source.includes("atob")) {
                    try {
                        const decoded = atob(str);
                        this.processDecoded(decoded, sources);
                        continue;
                    } catch (e) {}
                }

                try {
                    const data = JSON.parse(str);
                    if (Array.isArray(data)) {
                        this.extractFromArray(data, sources);
                    } else if (data.file || data.src || obj.url) {
                        this.extractFromObject(data, sources);
                    }
                } catch (e) {
                    // Direct URL
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

        // Also check for iframe embeds
        const iframeMatches = html.match(/<iframe[^>]+src=["']([^"']+)["']/gi);
        if (iframeMatches) {
            for (const iframe of iframeMatches) {
                const srcMatch = iframe.match(/src=["']([^"']+)["']/i);
                if (srcMatch) {
                    const src = srcMatch[1];
                    if (src.includes("1embed") || src.includes(".m3u8")) {
                        sources.push({
                            url: src,
                            quality: "auto",
                            headers: { "Referer": this.baseUrl }
                        });
                    }
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

        console.log(`1embed: Found ${unique.length} sources for TMDB ${tmdbId}`);
        return unique;
    }

    processDecoded(decoded, sources) {
        // Process atob-decoded content
        const patterns = [
            /sources\s*[:=]\s*(\[[\s\S]*?\])/gi,
            /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi,
        ];
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(decoded)) !== null) {
                try {
                    const data = JSON.parse(match[1] || match[0]);
                    if (Array.isArray(data)) this.extractFromArray(data, sources);
                } catch (e) {
                    if (match[0].includes(".m3u8")) {
                        sources.push({
                            url: match[0],
                            quality: this.detectQuality(match[0]),
                            headers: { "Referer": this.baseUrl }
                        });
                    }
                }
            }
        }
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

class OneEmbedPlugin {
    constructor() {
        this.scraper = new OneEmbedScraper();
    }

    async load(context) {
        console.log("1embed Plugin loaded");
    }

    async loadLinks(data) {
        return await this.scraper.loadLinks(data);
    }

    getRegisteredMainAPIs() {
        return [];
    }

    getRegisteredExtractorAPIs() {
        return [
            {
                name: "1embed",
                mainUrl: "https://1embed.cc",
                getExtractUrl: async (url) => url
            }
        ];
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { OneEmbedScraper, OneEmbedPlugin };
} else if (typeof window !== "undefined") {
    window.OneEmbedPlugin = OneEmbedPlugin;
}