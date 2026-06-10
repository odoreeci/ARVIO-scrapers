/**
 * Multi-Embed Aggregator Scraper for ARVIO
 * Target: Tries multiple embed services (vidking, 1embed, 2embed, vidlink, multiembed)
 * 
 * This is a meta-scraper that aggregates sources from all known embed backends
 * used by the streaming aggregation sites.
 */

class MultiEmbedScraper {
    constructor() {
        this.name = "MultiEmbed";
        this.version = "1.0";
        this.supportedTypes = ["movie", "tv"];
        
        // Known embed services with their URL patterns
        this.services = [
            {
                name: "Vidking",
                domain: "vidking.net",
                moviePattern: "https://www.vidking.net/embed/movie/{id}",
                tvPattern: "https://www.vidking.net/embed/tv/{id}/{season}/{episode}",
                priority: 1
            },
            {
                name: "1embed",
                domain: "1embed.cc",
                moviePattern: "https://1embed.cc/embed/movie/{id}",
                tvPattern: "https://1embed.cc/embed/tv/{id}/{season}/{episode}",
                priority: 2
            },
            {
                name: "2embed",
                domain: "2embed.cc",
                moviePattern: "https://2embed.cc/embed/movie/{id}",
                tvPattern: "https://2embed.cc/embed/tv/{id}/{season}/{episode}",
                priority: 3
            },
            {
                name: "Vidlink",
                domain: "vidlink.org",
                moviePattern: "https://vidlink.org/embed/movie/{id}",
                tvPattern: "https://vidlink.org/embed/tv/{id}/{season}/{episode}",
                priority: 4
            },
            {
                name: "Multiembed",
                domain: "multiembed.mov",
                moviePattern: "https://multiembed.mov/embed/movie/{id}",
                tvPattern: "https://multiembed.mov/embed/tv/{id}/{season}/{episode}",
                priority: 5
            },
            {
                name: "VidSrc",
                domain: "vidsrc.me",
                moviePattern: "https://vidsrc.me/embed/movie/{id}",
                tvPattern: "https://vidsrc.me/embed/tv/{id}/{season}/{episode}",
                priority: 6
            },
            {
                name: "Embed.su",
                domain: "embed.su",
                moviePattern: "https://embed.su/embed/movie/{id}",
                tvPattern: "https://embed.su/embed/tv/{id}/{season}/{episode}",
                priority: 7
            }
        ];
    }

    async loadLinks(info) {
        const { id, type, season, episode } = info;
        
        if (!id) {
            console.warn("MultiEmbed: No TMDB ID provided");
            return [];
        }

        // Try services in priority order, return first successful results
        for (const service of this.services.sort((a, b) => a.priority - b.priority)) {
            try {
                console.log(`MultiEmbed: Trying ${service.name}...`);
                const sources = await this.fetchFromService(service, id, type, season, episode);
                if (sources.length > 0) {
                    console.log(`MultiEmbed: ${service.name} returned ${sources.length} sources`);
                    return sources.map(s => ({ ...s, provider: service.name }));
                }
            } catch (error) {
                console.warn(`MultiEmbed: ${service.name} failed:`, error.message);
            }
        }

        console.log(`MultiEmbed: All services failed for TMDB ${id}`);
        return [];
    }

    async fetchFromService(service, id, type, season, episode) {
        const url = type === "movie"
            ? service.moviePattern.replace("{id}", id)
            : service.tvPattern.replace("{id}", id)
                .replace("{season}", season || 1)
                .replace("{episode}", episode || 1);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
                "Referer": `https://${service.domain}`
            },
            // Timeout after 10 seconds per service
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) return [];

        const html = await response.text();
        return this.parseEmbedPage(html, service.domain);
    }

    parseEmbedPage(html, domain) {
        const sources = [];

        // Common patterns across embed services
        const patterns = [
            // JSON sources array
            /sources\s*[:=]\s*(\[[\s\S]*?\])/gi,
            /playlist\s*[:=]\s*(\[[\s\S]*?\])/gi,
            /file\s*[:=]\s*(\[[\s\S]*?\])/gi,
            // Direct URLs
            /(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi,
            /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/gi,
            // Base64 encoded
            /eval\(atob\(['"]([^'"]+)['"]\)\)/gi,
            /atob\(['"]([^'"]+)['"]\)/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const str = match[1] || match[0];
                
                // Handle base64
                if (pattern.source.includes("atob") || pattern.source.includes("eval")) {
                    try {
                        const decoded = atob(str);
                        this.parseDecoded(decoded, sources);
                        continue;
                    } catch (e) {}
                }

                try {
                    const data = JSON.parse(str);
                    if (Array.isArray(data)) {
                        this.extractFromArray(data, sources);
                    } else if (data.file || data.src || data.url) {
                        this.extractFromObject(data, sources);
                    }
                } catch (e) {
                    // Direct URL
                    if (str.includes(".m3u8") || str.includes(".mp4")) {
                        sources.push({
                            url: str,
                            quality: this.detectQuality(str),
                            headers: { "Referer": `https://${domain}` }
                        });
                    }
                }
            }
        }

        // Also extract from iframe src attributes
        const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
        let iframeMatch;
        while ((iframeMatch = iframeRegex.exec(html)) !== null) {
            const src = iframeMatch[1];
            if (src.includes(".m3u8") || src.includes(domain)) {
                sources.push({
                    url: src,
                    quality: "auto",
                    headers: { "Referer": `https://${domain}` }
                });
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

        return unique;
    }

    parseDecoded(decoded, sources) {
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
                            headers: { "Referer": "https://" + (match[0].match(/https?:\/\/([^/]+)/)?.[1] || "") }
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
        const url = obj.file || obj.src || obj.url || obj.link || obj.path;
        if (!url) return;

        const quality = obj.quality || obj.label || obj.res || obj.type || this.detectQuality(url);
        const headers = obj.headers || { "Referer": obj.referer || "" };

        sources.push({ url, quality, headers });
    }

    detectQuality(url) {
        if (/2160|4k|uhd/i.test(url)) return "4K";
        if (/1080|fullhd/i.test(url)) return "1080p";
        if (/720|hd/i.test(url)) return "720p";
        if (/480/i.test(url)) return "480p";
        if (/360/i.test(url)) return "360p";
        return "auto";
    }
}

class MultiEmbedPlugin {
    constructor() {
        this.scraper = new MultiEmbedScraper();
    }

    async load(context) {
        console.log("MultiEmbed Plugin loaded - aggregating sources from multiple embed services");
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
                name: "MultiEmbed",
                mainUrl: "https://multiembed.aggregator",
                getExtractUrl: async (url) => url // Pass through to underlying extractors
            }
        ];
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { MultiEmbedScraper, MultiEmbedPlugin };
} else if (typeof window !== "undefined") {
    window.MultiEmbedPlugin = MultiEmbedPlugin;
}