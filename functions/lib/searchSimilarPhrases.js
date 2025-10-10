"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSimilarPhrases = searchSimilarPhrases;
const supabaseClient_1 = require("./supabaseClient");
const DEFAULT_TOP_K = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_EMBED_MODEL = (_a = process.env.GEMINI_EMBED_MODEL) !== null && _a !== void 0 ? _a : "text-embedding-004";
async function searchSimilarPhrases(query, topK = DEFAULT_TOP_K, threshold = DEFAULT_SIMILARITY_THRESHOLD, options = {}) {
    var _a, _b, _c, _d;
    const trimmed = typeof query === "string" ? query.trim() : "";
    if (!trimmed) {
        throw new Error("Query text is required to perform similarity search.");
    }
    if (!Number.isFinite(topK) || topK <= 0) {
        return [];
    }
    const clampedTopK = Math.max(1, Math.min(Math.floor(topK), 100));
    const clampedThreshold = clamp(threshold, 0, 1);
    const overallStart = Date.now();
    const embeddingStart = overallStart;
    const embedding = await generateEmbedding(trimmed, options.signal);
    if (!embedding.length) {
        (_a = options.onMetrics) === null || _a === void 0 ? void 0 : _a.call(options, {
            totalDurationMs: Date.now() - overallStart,
            embeddingDurationMs: Date.now() - embeddingStart,
            supabaseDurationMs: 0,
            matchCount: 0,
            topSimilarity: null,
        });
        return [];
    }
    const client = (_b = options.client) !== null && _b !== void 0 ? _b : supabaseClient_1.SupabaseClient.fromEnv(Object.assign({ fetchImpl: globalThis.fetch }, options.clientConfigOverrides));
    const supabaseStart = Date.now();
    const payload = {
        p_query_embedding: toVectorLiteral(embedding),
        p_match_count: clampedTopK,
        p_match_threshold: clampedThreshold,
        p_model: DEFAULT_EMBED_MODEL,
    };
    const rows = (_c = (await client.rpc("match_phrase_embeddings", payload, {
        accessToken: options.accessToken,
        signal: options.signal,
    }))) !== null && _c !== void 0 ? _c : [];
    const results = Array.isArray(rows) ? rows.map(mapRowToResult) : [];
    const supabaseDurationMs = Date.now() - supabaseStart;
    const totalDurationMs = Date.now() - overallStart;
    const topSimilarity = results.length ? results[0].similarity : null;
    (_d = options.onMetrics) === null || _d === void 0 ? void 0 : _d.call(options, {
        totalDurationMs,
        embeddingDurationMs: supabaseStart - embeddingStart,
        supabaseDurationMs,
        matchCount: results.length,
        topSimilarity,
    });
    return results;
}
async function generateEmbedding(text, signal) {
    var _a;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured for embedding requests.");
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_EMBED_MODEL}:embedContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify({
            content: {
                parts: [{ text }],
            },
        }),
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => "[unreadable body]");
        throw new Error(`Gemini embedding request failed (${response.status}): ${errorText}`);
    }
    const json = await response.json();
    const embedding = (_a = json === null || json === void 0 ? void 0 : json.embedding) === null || _a === void 0 ? void 0 : _a.values;
    if (!Array.isArray(embedding)) {
        throw new Error("Gemini response missing embedding values.");
    }
    return embedding
        .map((value) => (typeof value === "number" ? value : Number(value)))
        .filter((value) => Number.isFinite(value));
}
function mapRowToResult(row) {
    const similarity = typeof row.similarity === "number"
        ? row.similarity
        : typeof row.distance === "number"
            ? 1 - row.distance
            : 0;
    const distance = typeof row.distance === "number" ? row.distance : Math.max(1 - similarity, 0);
    const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {});
    const translations = Array.isArray(row.translations)
        ? row.translations.map((item) => {
            var _a, _b, _c, _d, _e;
            return ({
                id: (_a = item.id) !== null && _a !== void 0 ? _a : "",
                variant: (_b = item.variant) !== null && _b !== void 0 ? _b : "",
                translation: (_c = item.translation) !== null && _c !== void 0 ? _c : "",
                tone: (_d = item.tone) !== null && _d !== void 0 ? _d : null,
                metadata: (_e = (item.metadata && typeof item.metadata === "object"
                    ? item.metadata
                    : {})) !== null && _e !== void 0 ? _e : {},
            });
        })
        : [];
    return {
        phraseId: row.phrase_id,
        phrase: row.phrase,
        similarity,
        distance,
        metadata: metadata !== null && metadata !== void 0 ? metadata : {},
        translations,
    };
}
function toVectorLiteral(values) {
    if (!values.length) {
        throw new Error("Cannot convert empty embedding array to vector literal.");
    }
    const normalized = values.map((value) => Number.isFinite(value) ? value : 0);
    return `[${normalized.join(",")}]`;
}
function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=searchSimilarPhrases.js.map