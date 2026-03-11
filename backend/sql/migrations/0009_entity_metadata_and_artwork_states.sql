create table if not exists entity_metadata_fields (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  field_key text not null check (
    field_key in (
      'official_youtube',
      'official_x',
      'official_instagram',
      'agency_name',
      'debut_year',
      'representative_image'
    )
  ),
  value_json jsonb,
  status text not null check (status in ('resolved', 'review_needed', 'unresolved', 'placeholder')),
  provenance text not null,
  source_url text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_metadata_fields_entity_id_field_key_key unique (entity_id, field_key)
);

create index if not exists idx_entity_metadata_fields_entity_id
  on entity_metadata_fields (entity_id);

create index if not exists idx_entity_metadata_fields_status
  on entity_metadata_fields (status);

alter table release_artwork
  add column if not exists artwork_status text,
  add column if not exists artwork_provenance text;

update release_artwork
set artwork_status = case
  when artwork_source_type = 'placeholder' then 'placeholder'
  when coalesce(cover_image_url, thumbnail_image_url) is not null then 'verified'
  else 'unresolved'
end
where artwork_status is null;

update release_artwork
set artwork_provenance = case
  when artwork_source_type is not null then 'releaseArtwork.' || artwork_source_type
  else 'releaseArtwork.legacy_row'
end
where artwork_provenance is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'release_artwork_artwork_status_check'
  ) then
    alter table release_artwork
      add constraint release_artwork_artwork_status_check
      check (artwork_status in ('verified', 'placeholder', 'review_needed', 'unresolved'));
  end if;
end $$;

alter table release_artwork
  alter column artwork_status set default 'unresolved',
  alter column artwork_status set not null,
  alter column artwork_provenance set default 'releaseArtwork.legacy_row',
  alter column artwork_provenance set not null;
