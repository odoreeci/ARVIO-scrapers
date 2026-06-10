/**
 * Kotlin/DEX Extension Template for ARVIO (CloudStream-compatible)
 * 
 * This is a template for creating CloudStream-compatible DEX extensions (.cs3 files)
 * that work with ARVIO's ExternalExtensionLoader.
 * 
 * To build: ./gradlew :extension:assembleRelease
 * Output: build/outputs/apk/release/extension-release.apk (rename to .cs3)
 * 
 * Place the .cs3 file in your repo's plugins.json for distribution.
 */

package com.arvio.extensions.multisource

import com.lagradost.cloudstream3.plugins.BasePlugin
import com.lagradost.cloudstream3.plugins.CloudstreamPlugin
import com.lagradost.cloudstream3.MainAPI
import com.lagradost.cloudstream3.LoadResponse
import com.lagradost.cloudstream3.MovieLoadResponse
import com.lagradost.cloudstream3.TvSeriesLoadResponse
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.ExtractorLinkType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
import java.net.HttpURLConnection

@CloudstreamPlugin
class MultiEmbedPlugin : BasePlugin() {

    override val name = "MultiEmbed Aggregator"
    override val version = "1.0.0"
    override val author = "ARVIO Community"
    override val description = "Aggregates sources from multiple embed services (vidking, 1embed, 2embed, vidlink, vidsrc, embed.su)"
    override val iconUrl = "https://raw.githubusercontent.com/ProdigyV21/ARVIO-scrapers/main/icon.png"
    override val supportedTypes = listOf("movie", "tv")

    private val embedServices = listOf(
        EmbedService("Vidking", "vidking.net",
            "https://www.vidking.net/embed/movie/%s",
            "https://www.vidking.net/embed/tv/%s/%d/%d",
            1),
        EmbedService("1embed", "1embed.cc",
            "https://1embed.cc/embed/movie/%s",
            "https://1embed.cc/embed/tv/%s/%d/%d",
            2),
        EmbedService("2embed", "2embed.cc",
            "https://2embed.cc/embed/movie/%s",
            "https://2embed.cc/embed/tv/%s/%d/%d",
            3),
        EmbedService("Vidlink", "vidlink.org",
            "https://vidlink.org/embed/movie/%s",
            "https://vidlink.org/embed/tv/%s/%d/%d",
            4),
        EmbedService("Vidsrc", "vidsrc.me",
            "https://vidsrc.me/embed/movie/%s",
            "https://vidsrc.me/embed/tv/%s/%d/%d",
            5),
        EmbedService("Embed.su", "embed.su",
            "https://embed.su/embed/movie/%s",
            "https://embed.su/embed/tv/%s/%d/%d",
            6)
    )

    override fun load(context: android.content.Context) {
        // Initialize any required components
        super.load(context)
    }

    override fun getRegisteredMainAPIs(): List<MainAPI> {
        return listOf(MultiEmbedAPI())
    }

    override fun getRegisteredExtractorAPIs() = emptyList()

    companion object {
        const val TAG = "MultiEmbedPlugin"
    }
}

data class EmbedService(
    val name: String,
    val domain: String,
    val moviePattern: String,
    val tvPattern: String,
    val priority: Int
)

class MultiEmbedAPI : MainAPI() {

    override val name = "MultiEmbed"
    override val baseUrl = "https://multiembed.aggregator"
    override val supportedTypes = listOf("movie", "tv")

    override fun load(url: String): LoadResponse? {
        // This receives the TMDB JSON from ARVIO: {"id": 12345, "type": "movie"}
        // or TMDB URL: "https://www.themoviedb.org/movie/12345"
        return try {
            val json = JSONObject(url)
            val id = json.getInt("id")
            val type = json.getString("type")
            
            if (type == "movie") {
                MovieLoadResponse().apply {
                    this.data = buildMovieData(id)
                }
            } else {
                TvSeriesLoadResponse().apply {
                    this.data = buildSeriesData(id)
                }
            }
        } catch (e: Exception) {
            // Try as TMDB URL
            if (url.contains("themoviedb.org")) {
                val id = extractTmdbId(url)
                if (id > 0) {
                    if (url.contains("/movie/")) {
                        MovieLoadResponse().apply { this.data = buildMovieData(id) }
                    } else {
                        TvSeriesLoadResponse().apply { this.data = buildSeriesData(id) }
                    }
                } else null
            } else null
        }
    }

    override fun loadLinks(
        data: String,
        isCasting: Boolean,
        callback: (ExtractorLink) -> Unit
    ): Boolean {
        // Parse the TMDB ID and episode info from data
        val json = try { JSONObject(data) } catch (e: Exception) { return false }
        
        val tmdbId = json.optInt("id", json.optInt("tmdbID", 0))
        val type = json.optString("type", json.optString("mediaType", "movie"))
        val season = json.optInt("season", 0)
        val episode = json.optInt("episode", 0)
        
        if (tmdbId == 0) return false

        // Run scraping on IO thread
        withContext(Dispatchers.IO) {
            val sources = scrapeAllServices(tmdbId, type, season, episode)
            for (source in sources) {
                callback(source.toExtractorLink())
            }
        }
        return true
    }

    private suspend fun scrapeAllServices(
        tmdbId: Int,
        type: String,
        season: Int,
        episode: Int
    ): List<EmbedSource> {
        val allSources = mutableListOf<EmbedSource>()
        
        // Sort services by priority
        val sortedServices = embedServices.sortedBy { it.priority }
        
        for (service in sortedServices) {
            try {
                val sources = fetchFromService(service, tmdbId.toString(), type, season, episode)
                if (sources.isNotEmpty()) {
                    // Return first successful service's results
                    return sources.map { it.copy(provider = service.name) }
                }
            } catch (e: Exception) {
                // Continue to next service
            }
        }
        return allSources
    }

    private suspend fun fetchFromService(
        service: EmbedService,
        id: String,
        type: String,
        season: Int,
        episode: Int
    ): List<EmbedSource> {
        val url = if (type == "movie") {
            String.format(service.moviePattern, id)
        } else {
            String.format(service.tvPattern, id, season.ifZero { 1 }, episode.ifZero { 1 })
        }

        val html = withTimeoutOrNull(10000) {
            withContext(Dispatchers.IO) {
                fetchHtml(url, service.domain)
            }
        } ?: return emptyList()

        return parseEmbedPage(html, service.domain)
    }

    private fun fetchHtml(url: String, referer: String): String {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.apply {
            requestMethod = "GET"
            connectTimeout = 10000
            readTimeout = 10000
            setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36")
            setRequestProperty("Referer", "https://$referer")
        }
        return connection.getInputStream().bufferedReader().readText()
    }

    private fun parseEmbedPage(html: String, domain: String): List<EmbedSource> {
        val sources = mutableListOf<EmbedSource>()

        // Common regex patterns
        val patterns = listOf(
            Regex("""sources\s*[:=]\s*(\[[\s\S]*?\])"""),
            Regex("""playlist\s*[:=]\s*(\[[\s\S]*?\])"""),
            Regex("""file\s*[:=]\s*(\[[\s\S]*?\])"""),
            Regex("""(https?://[^"'\s]+\.m3u8[^"'\s]*)"""),
            Regex("""(https?://[^"'\s]+\.mp4[^"'\s]*)"""),
            Regex("""eval\(atob\(['"]([^'"]+)['"]\)\)"""),
            Regex("""atob\(['"]([^'"]+)['"]\)""")
        )

        for (pattern in patterns) {
            pattern.findAll(html).forEach { match ->
                val str = match.groupValues.getOrNull(1) ?: match.value
                
                // Handle base64
                if (pattern.pattern.contains("atob")) {
                    try {
                        val decoded = android.util.Base64.decode(str, android.util.Base64.DEFAULT)
                        parseDecoded(String(decoded), sources, domain)
                        continue
                    } catch (e: Exception) {}
                }

                try {
                    val json = org.json.JSONArray(str)
                    for (i in 0 until json.length()) {
                        val obj = json.getJSONObject(i)
                        parseSourceObject(obj, sources, domain)
                    }
                } catch (e: Exception) {
                    if (str.contains(".m3u8") || str.contains(".mp4")) {
                        sources.add(EmbedSource(
                            url = str,
                            quality = detectQuality(str),
                            headers = mapOf("Referer" to "https://$domain/")
                        ))
                    }
                }
            }
        }

        // Check iframe src
        Regex("""<iframe[^>]+src=["']([^"']+)["']""").findAll(html).forEach { m ->
            val src = m.groupValues[1]
            if (src.contains(".m3u8") || src.contains(domain)) {
                sources.add(EmbedSource(
                    url = src,
                    quality = "auto",
                    headers = mapOf("Referer" to "https://$domain/")
                ))
            }
        }

        // Deduplicate
        return sources.distinctBy { it.url }
    }

    private fun parseDecoded(decoded: String, sources: MutableList<EmbedSource>, domain: String) {
        Regex("""sources\s*[:=]\s*(\[[\s\S]*?\])""").findAll(decoded).forEach { m ->
            try {
                org.json.JSONArray(m.groupValues[1]).also { json ->
                    for (i in 0 until json.length()) {
                        parseSourceObject(json.getJSONObject(i), sources, domain)
                    }
                }
            } catch (e: Exception) {
                if (m.value.contains(".m3u8")) {
                    val url = m.value.trim()
                    if (url.startsWith("http")) {
                        sources.add(EmbedSource(url, detectQuality(url), mapOf("Referer" to "https://$domain/")))
                    }
                }
            }
        }
    }

    private fun parseSourceObject(obj: org.json.JSONObject, sources: MutableList<EmbedSource>, domain: String) {
        val url = obj.optString("file", obj.optString("src", obj.optString("url", obj.optString("link", ""))))
        if (url.isEmpty()) return

        val quality = obj.optString("quality", obj.optString("label", obj.optString("res", detectQuality(url))))
        val headers = mutableMapOf("Referer" to "https://$domain/")
        if (obj.has("headers")) {
            val h = obj.getJSONObject("headers")
            h.keys().forEach { key -> headers[key] = h.getString(key) }
        }

        sources.add(EmbedSource(url, quality, headers))
    }

    private fun detectQuality(url: String): String {
        return if (Regex("""2160|4k|uhd""").matches(url)) "4K"
        else if (Regex("""1080|fullhd""").matches(url)) "1080p"
        else if (Regex("""720|hd""").matches(url)) "720p"
        else if (Regex("""480""").matches(url)) "480p"
        else if (Regex("""360""").matches(url)) "360p"
        else "auto"
    }

    private fun extractTmdbId(url: String): Int {
        val patterns = listOf(
            Regex("""/movie/(\d+)"""),
            Regex("""/tv/(\d+)"""),
            Regex("""id[=/](\d+)""")
        )
        for (p in patterns) {
            p.find(url)?.groupValues?.get(1)?.toIntOrNull()?.let { return it }
        }
        return 0
    }

    private fun buildMovieData(id: Int): String {
        return """{"id": $id, "type": "movie"}""".trimIndent()
    }

    private fun buildSeriesData(id: Int): String {
        return """{"id": $id, "type": "tv"}""".trimIndent()
    }
}

data class EmbedSource(
    val url: String,
    val quality: String,
    val headers: Map<String, String>,
    val provider: String = ""
) {
    fun toExtractorLink(): ExtractorLink {
        return ExtractorLink(
            url = url,
            quality = quality,
            type = if (url.contains(".mp4")) ExtractorLinkType.MP4 else ExtractorLinkType.HLS,
            headers = headers,
            provider = if (provider.isEmpty()) "MultiEmbed" else provider
        )
    }
}