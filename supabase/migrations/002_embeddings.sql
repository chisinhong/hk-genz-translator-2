-- Helper to upsert embeddings for a given phrase and model
create or replace function public.upsert_phrase_embedding(
  p_phrase_id uuid,
  p_model text,
  p_embedding text,
  p_embedded_at timestamptz default now()
) returns void as $$
begin
  insert into public.phrase_embeddings(phrase_id, model, embedding, embedded_at)
  values (
    p_phrase_id,
    coalesce(p_model, 'text-embedding-3-small'),
    p_embedding::vector,
    coalesce(p_embedded_at, now())
  )
  on conflict (phrase_id, model)
  do update
    set embedding = excluded.embedding,
        embedded_at = excluded.embedded_at;
end;
$$ language plpgsql;

-- Return phrases that need embeddings (missing or stale)
create or replace function public.get_phrases_pending_embedding(
  p_model text,
  p_limit integer default 50
) returns table (
  phrase_id uuid,
  phrase text,
  updated_at timestamptz
) as $$
  select
    p.id as phrase_id,
    p.phrase,
    p.updated_at
  from public.phrases p
  left join public.phrase_embeddings e
    on p.id = e.phrase_id and e.model = coalesce(p_model, 'text-embedding-3-small')
  where e.phrase_id is null
     or e.embedded_at < p.updated_at
  order by p.updated_at desc
  limit coalesce(p_limit, 50);
$$ language sql stable;
