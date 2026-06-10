/**
 * Test script for ARVIO JS scrapers
 * Run with: node test_scrapers.js
 * 
 * This tests the scrapers against real embed services
 */

const fs = require('fs');
const path = require('path');

// Load scrapers
const vidkingCode = fs.readFileSync('./vidking_scraper.js', 'utf8');
const oneEmbedCode = fs.readFileSync('./1embed_scraper.js', 'utf8');
const multiEmbedCode = fs.readFileSync('./multiembed_scraper.js', 'utf8');

// Execute in node context - need to handle module.exports pattern
const vm = require('vm');
const context = { console, fetch, atob, setTimeout, clearTimeout, URL, 
    module: { exports: {} }, 
    window: { console, fetch, atob, setTimeout, clearTimeout, URL } };

vm.createContext(context);
vm.runInContext(vidkingCode, context);
const VidkingScraper = context.VidkingScraper || context.module.exports.VidkingScraper || context.window.VidkingScraper;

vm.runInContext(oneEmbedCode, context);
const OneEmbedScraper = context.OneEmbedScraper || context.module.exports.OneEmbedScraper || context.window.OneEmbedScraper;

vm.runInContext(multiEmbedCode, context);
const MultiEmbedScraper = context.MultiEmbedScraper || context.module.exports.MultiEmbedScraper || context.window.MultiEmbedScraper;

async function testScrapers() {
    // Test TMDB IDs
    const testCases = [
        { id: "936075", type: "movie", title: "Michael (2026)" },
        { id: "603", type: "movie", title: "The Matrix" },
        { id: "1396", type: "tv", season: 1, episode: 1, title: "Breaking Bad S01E01" },
        { id: "82856", type: "movie", title: "The Batman" },
    ];

    console.log("=".repeat(60));
    console.log("TESTING ARVIO SCRAPERS");
    console.log("=".repeat(60));

    // Test Vidking
    console.log("\n🎬 Testing Vidking Scraper...");
    const vidking = new VidkingScraper();
    for (const tc of testCases.filter(t => t.type === "movie")) {
        try {
            const sources = await vidking.loadLinks({ 
                id: tc.id, 
                type: tc.type,
                season: tc.season, 
                episode: tc.episode 
            });
            console.log(`  ${tc.title} (${tc.id}): ${sources.length} sources`);
            sources.slice(0, 3).forEach(s => console.log(`    - ${s.quality}: ${s.url.substring(0, 80)}...`));
        } catch (e) {
            console.log(`  ${tc.title}: ERROR - ${e.message}`);
        }
    }

    // Test 1embed
    console.log("\n🎬 Testing 1embed Scraper...");
    const oneEmbed = new OneEmbedScraper();
    for (const tc of testCases.filter(t => t.type === "movie")) {
        try {
            const sources = await oneEmbed.loadLinks({ 
                id: tc.id, 
                type: tc.type,
                season: tc.season, 
                episode: tc.episode 
            });
            console.log(`  ${tc.title} (${tc.id}): ${sources.length} sources`);
            sources.slice(0, 3).forEach(s => console.log(`    - ${s.quality}: ${s.url.substring(0, 80)}...`));
        } catch (e) {
            console.log(`  ${tc.title}: ERROR - ${e.message}`);
        }
    }

    // Test MultiEmbed
    console.log("\n🎬 Testing MultiEmbed Aggregator...");
    const multiEmbed = new MultiEmbedScraper();
    for (const tc of testCases.filter(t => t.type === "movie")) {
        try {
            const sources = await multiEmbed.loadLinks({ 
                id: tc.id, 
                type: tc.type,
                season: tc.season, 
                episode: tc.episode 
            });
            console.log(`  ${tc.title} (${tc.id}): ${sources.length} sources`);
            const providers = [...new Set(sources.map(s => s.provider))];
            console.log(`    Providers: ${providers.join(", ")}`);
            sources.slice(0, 2).forEach(s => console.log(`    - [${s.provider}] ${s.quality}: ${s.url.substring(0, 80)}...`));
        } catch (e) {
            console.log(`  ${tc.title}: ERROR - ${e.message}`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("TEST COMPLETE");
    console.log("=".repeat(60));
}

testScrapers().catch(console.error);