-- RPC for semantic search against phrase embeddings
create or replace function public.match_phrase_embeddings(
  p_query_embedding text,
  p_match_threshold double precision default 0.7,
  p_match_count integer default 5,
  p_model text default 'text-embedding-3-small'
) returns table (
  phrase_id uuid,
  phrase text,
  metadata jsonb,
  similarity double precision,
  distance double precision,
  translations jsonb
) as $$
declare
  query_vector vector;
  max_distance double precision;
begin
  if p_query_embedding is null or length(trim(p_query_embedding)) = 0 then
    raise exception 'p_query_embedding cannot be null or empty';
  end if;

  query_vector := p_query_embedding::vector;
  max_distance := 1 - least(greatest(coalesce(p_match_threshold, 0.7), 0), 1);

  return query
    select
      p.id as phrase_id,
      p.phrase,
      coalesce(p.metadata, '{}'::jsonb) as metadata,
      1 - (e.embedding <#> query_vector) as similarity,
      e.embedding <#> query_vector as distance,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'variant', t.variant,
            'translation', t.translation,
            'tone', t.tone,
            'metadata', coalesce(t.metadata, '{}'::jsonb)
          )
          order by t.created_at asc
        ) filter (where t.id is not null),
        '[]'::jsonb
      ) as translations
    from public.phrase_embeddings e
    join public.phrases p on p.id = e.phrase_id
    left join public.phrase_translations t on t.phrase_id = p.id
    where e.model = coalesce(p_model, 'text-embedding-3-small')
      and (e.embedding <#> query_vector) <= max_distance
    group by p.id, e.embedding
    order by e.embedding <#> query_vector asc
    limit greatest(coalesce(p_match_count, 5), 1);
end;
$$ language plpgsql stable;
