alter table release_service_links
  drop constraint if exists release_service_links_status_check;

alter table release_service_links
  add constraint release_service_links_status_check
  check (
    status in (
      'canonical',
      'manual_override',
      'relation_match',
      'needs_review',
      'unresolved',
      'no_link',
      'no_mv'
    )
  );
