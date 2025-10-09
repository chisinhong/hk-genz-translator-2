-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- Master table for phrases / slang entries
create table if not exists public.phrases (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  normalized_phrase text generated always as (lower(trim(phrase))) stored,
  language text not null default 'yue',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists phrases_normalized_phrase_key
  on public.phrases(normalized_phrase);

-- Individual translations / tone variations for each phrase
create table if not exists public.phrase_translations (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references public.phrases(id) on delete cascade,
  variant text not null,
  translation text not null,
  tone text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists phrase_translations_phrase_variant_key
  on public.phrase_translations(phrase_id, variant);

-- Vector store for semantic search
create table if not exists public.phrase_embeddings (
  phrase_id uuid primary key references public.phrases(id) on delete cascade,
  model text not null,
  embedding vector(1536) not null,
  embedded_at timestamptz not null default now()
);

-- Usage analytics for rate limiting / insights
create table if not exists public.translation_usage (
  id bigserial primary key,
  phrase_id uuid references public.phrases(id) on delete set null,
  translation_id uuid references public.phrase_translations(id) on delete set null,
  user_id text,
  source text,
  quota_snapshot integer,
  used_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);

create index if not exists translation_usage_phrase_id_idx
  on public.translation_usage(phrase_id);

create index if not exists translation_usage_used_at_idx
  on public.translation_usage(used_at);

-- Raw user submissions (pending review)
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  explanation text not null,
  example text,
  status text not null default 'pending',
  user_id text,
  source text default 'firestore',
  origin_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists submissions_origin_id_key
  on public.submissions(origin_id)
  where origin_id is not null;

-- Trigger to keep updated_at current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists phrases_set_updated_at on public.phrases;
create trigger phrases_set_updated_at
before update on public.phrases
for each row execute function public.set_updated_at();
