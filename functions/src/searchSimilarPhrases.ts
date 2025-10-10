import { SupabaseClient, type SupabaseClientConfig } from "./supabaseClient";

const DEFAULT_TOP_K = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL ?? "text-embedding-004";

interface SearchOptions {
  accessToken?: string;
  signal?: AbortSignal;
  client?: SupabaseClient;
  clientConfigOverrides?: Partial<SupabaseClientConfig>;
}

interface TranslationRow {
  id?: string;
  variant?: string;
  translation?: string;
  tone?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface SearchResultRow {
  phrase_id: string;
  phrase: string;
  metadata?: Record<string, unknown> | null;
  similarity?: number | null;
  distance?: number | null;
  translations?: TranslationRow[] | null;
}

export interface SimilarPhraseTranslation {
  id: string;
  variant: string;
  translation: string;
  tone: string | null;
  metadata: Record<string, unknown>;
}

export interface SimilarPhraseResult {
  phraseId: string;
  phrase: string;
  similarity: number;
  distance: number;
  metadata: Record<string, unknown>;
  translations: SimilarPhraseTranslation[];
}

export async function searchSimilarPhrases(
  query: string,
  topK = DEFAULT_TOP_K,
  threshold = DEFAULT_SIMILARITY_THRESHOLD,
  options: SearchOptions = {},
): Promise<SimilarPhraseResult[]> {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    throw new Error("Query text is required to perform similarity search.");
  }

  if (!Number.isFinite(topK) || topK <= 0) {
    return [];
  }

  const clampedTopK = Math.max(1, Math.min(Math.floor(topK), 100));
  const clampedThreshold = clamp(threshold, 0, 1);

  const embedding = await generateEmbedding(trimmed, options.signal);
  if (!embedding.length) {
    return [];
  }

  const client =
    options.client ??
    SupabaseClient.fromEnv({
      fetchImpl: globalThis.fetch,
      ...options.clientConfigOverrides,
    });

  const payload = {
    p_query_embedding: toVectorLiteral(embedding),
    p_match_count: clampedTopK,
    p_match_threshold: clampedThreshold,
    p_model: DEFAULT_EMBED_MODEL,
  };

  const rows =
    (await client.rpc<SearchResultRow[]>("match_phrase_embeddings", payload, {
      accessToken: options.accessToken,
      signal: options.signal,
    })) ?? [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(mapRowToResult);
}

async function generateEmbedding(
  text: string,
  signal?: AbortSignal,
): Promise<number[]> {
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
    throw new Error(
      `Gemini embedding request failed (${response.status}): ${errorText}`,
    );
  }

  const json = await response.json();
  const embedding = json?.embedding?.values;
  if (!Array.isArray(embedding)) {
    throw new Error("Gemini response missing embedding values.");
  }

  return embedding
    .map((value: unknown) => (typeof value === "number" ? value : Number(value)))
    .filter((value: number) => Number.isFinite(value));
}

function mapRowToResult(row: SearchResultRow): SimilarPhraseResult {
  const similarity =
    typeof row.similarity === "number"
      ? row.similarity
      : typeof row.distance === "number"
        ? 1 - row.distance
        : 0;

  const distance =
    typeof row.distance === "number" ? row.distance : Math.max(1 - similarity, 0);

  const metadata =
    (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as
      | Record<string, unknown>
      | undefined;

  const translations = Array.isArray(row.translations)
    ? row.translations.map((item) => ({
        id: item.id ?? "",
        variant: item.variant ?? "",
        translation: item.translation ?? "",
        tone: item.tone ?? null,
        metadata:
          (item.metadata && typeof item.metadata === "object"
            ? item.metadata
            : {}) ?? {},
      }))
    : [];

  return {
    phraseId: row.phrase_id,
    phrase: row.phrase,
    similarity,
    distance,
    metadata: metadata ?? {},
    translations,
  };
}

function toVectorLiteral(values: number[]): string {
  if (!values.length) {
    throw new Error("Cannot convert empty embedding array to vector literal.");
  }

  const normalized = values.map((value) =>
    Number.isFinite(value) ? value : 0,
  );

  return `[${normalized.join(",")}]`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
