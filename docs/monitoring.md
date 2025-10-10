# Monitoring & Analytics

## pgvector Query Performance

- The `queryPhrases` Firebase callable records structured logs with request IDs, durations, match counts, and similarity scores. Stream these logs to BigQuery or Grafana by creating a Cloud Logging sink that filters on `resource.type="cloud_function"` and `jsonPayload.requestId`.
- Each search emits:
  - `totalDurationMs`
  - `embeddingDurationMs`
  - `supabaseDurationMs`
  - `matchCount`
  - `topSimilarity`
- Recommended dashboard widgets:
  - 95th percentile `totalDurationMs`
  - Error rate (`severity=ERROR`)
  - `matchCount` histogram to detect empty results

## Supabase Metrics

- Enable `pg_stat_statements` extension and monitor the `match_phrase_embeddings` function:

```sql
select 
  now() as collected_at,
  (sum(total_time) / sum(calls)) as avg_exec_ms,
  sum(calls) as total_calls
from pg_stat_statements
where query ilike '%match_phrase_embeddings%';
```

- Expose results through Supabase dashboards or pipe to Grafana/Metabase.

## Cloud Function Metrics

- Cloud Monitoring view: `Functions > queryPhrases`. Add charts for "Execution time" and "Execution count".
- Structured logs allow you to group by `requestId` and `uid` to analyse usage patterns.

## Data Retention

- Embeddings: Keep the latest vector per phrase/model. Use the `public.upsert_phrase_embedding` helper which overwrites older rows. Schedule a cleanup job to delete orphaned embeddings:

```sql
delete from public.phrase_embeddings
where phrase_id not in (select id from public.phrases);
```

- Search metrics (if persisted) should be retained for 90 days. When storing in BigQuery, apply a table expiration policy. For Cloud Logging sinks, set the destination dataset with `defaultTableExpirationMs = 7776000000` (90 days).
- Translation usage history (`public.translation_usage`) can be trimmed after 12 months using a cron job:

```sql
delete from public.translation_usage
where used_at < now() - interval '12 months';
```

Update the incident response runbook to include a monthly review of retention sweeps.
