const POSITIVE_MV_STATUSES = new Set(['canonical', 'manual_override', 'relation_match', 'verified']);
const POSITIVE_TITLE_TRACK_STATUSES = new Set([
  'verified',
  'inferred',
  'manual_override',
  'auto_single',
  'auto_double',
]);

export const SAME_DAY_FIXTURES = [
  {
    key: 'yena_suppression',
    label: 'YENA same-day suppression',
    group: 'YENA',
    scheduled_date: '2026-03-11',
    release_title: 'LOVE CATCHER',
    stream: 'album',
    mode: 'suppression',
  },
  {
    key: 'p1harmony_acceptance',
    label: 'P1Harmony same-day release acceptance',
    group: 'P1Harmony',
    scheduled_date: '2026-03-12',
    release_title: null,
    stream: null,
    mode: 'acceptance',
  },
];

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDate(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function daysBetween(left, right) {
  return Math.floor((left.getTime() - right.getTime()) / 86_400_000);
}

function isPositiveMv(detail) {
  return POSITIVE_MV_STATUSES.has(normalizeText(detail?.youtube_video_status));
}

function hasTitleTrack(detail) {
  const tracks = Array.isArray(detail?.tracks) ? detail.tracks : [];
  if (tracks.some((track) => track?.is_title_track === true)) {
    return true;
  }
  return POSITIVE_TITLE_TRACK_STATUSES.has(normalizeText(detail?.title_track_status));
}

function hasTrackList(detail) {
  return Array.isArray(detail?.tracks) && detail.tracks.length > 0;
}

function hasArtwork(artwork) {
  return Boolean(normalizeText(artwork?.cover_image_url));
}

function buildReleaseCandidates(releases, fixture, scheduledDate) {
  const candidates = [];
  for (const row of releases) {
    if (normalizeText(row?.group) !== fixture.group) {
      continue;
    }
    for (const [streamKey, fallbackStream] of [
      ['latest_song', 'song'],
      ['latest_album', 'album'],
    ]) {
      const release = row?.[streamKey];
      if (!release) {
        continue;
      }
      const releaseDate = normalizeDate(release.date);
      if (!releaseDate) {
        continue;
      }
      const deltaDays = daysBetween(releaseDate, scheduledDate);
      candidates.push({
        group: fixture.group,
        release_title: release.title ?? null,
        release_date: release.date ?? null,
        stream: fallbackStream,
        release_kind: release.release_kind ?? null,
        release_format: release.release_format ?? release.release_kind ?? null,
        source: release.source ?? null,
        delta_days: deltaDays,
      });
    }
  }

  return candidates
    .filter((candidate) => candidate.delta_days >= 0 && candidate.delta_days <= 1)
    .sort((left, right) => {
      const leftTitleMatch = fixture.release_title && normalizeText(left.release_title) === fixture.release_title ? 0 : 1;
      const rightTitleMatch = fixture.release_title && normalizeText(right.release_title) === fixture.release_title ? 0 : 1;
      if (leftTitleMatch !== rightTitleMatch) {
        return leftTitleMatch - rightTitleMatch;
      }
      if (left.delta_days !== right.delta_days) {
        return left.delta_days - right.delta_days;
      }
      return normalizeText(left.release_title).localeCompare(normalizeText(right.release_title));
    });
}

function findDetail(details, release) {
  if (!release) {
    return null;
  }
  const exact = details.find(
    (row) =>
      normalizeText(row?.group) === release.group &&
      normalizeText(row?.release_title) === normalizeText(release.release_title) &&
      normalizeText(row?.release_date) === normalizeText(release.release_date) &&
      normalizeText(row?.stream) === normalizeText(release.stream),
  );
  if (exact) {
    return exact;
  }
  return (
    details.find(
      (row) =>
        normalizeText(row?.group) === release.group &&
        normalizeText(row?.release_date) === normalizeText(release.release_date),
    ) ?? null
  );
}

function findArtwork(artworkRows, release) {
  if (!release) {
    return null;
  }
  const exact = artworkRows.find(
    (row) =>
      normalizeText(row?.group) === release.group &&
      normalizeText(row?.release_title) === normalizeText(release.release_title) &&
      normalizeText(row?.release_date) === normalizeText(release.release_date) &&
      normalizeText(row?.stream) === normalizeText(release.stream),
  );
  if (exact) {
    return exact;
  }
  return (
    artworkRows.find(
      (row) =>
        normalizeText(row?.group) === release.group &&
        normalizeText(row?.release_date) === normalizeText(release.release_date),
    ) ?? null
  );
}

function findExactUpcoming(upcomingSignals, fixture) {
  return (
    upcomingSignals.find(
      (row) =>
        normalizeText(row?.group) === fixture.group &&
        normalizeText(row?.scheduled_date) === fixture.scheduled_date &&
        normalizeText(row?.date_precision) === 'exact',
    ) ?? null
  );
}

function buildSuppressionFixtureResult(fixture, releases, upcomingSignals, referenceDate) {
  const scheduledDate = normalizeDate(fixture.scheduled_date);
  const exactUpcoming = findExactUpcoming(upcomingSignals, fixture);
  const releaseCandidates = buildReleaseCandidates(releases, fixture, scheduledDate);
  const promotedRelease = releaseCandidates[0] ?? null;
  const releaseExists = Boolean(promotedRelease);
  const upcomingShouldBeSuppressed = Boolean(
    exactUpcoming && releaseExists && daysBetween(referenceDate, scheduledDate) >= 1,
  );
  const userFacingUpcomingOnly = Boolean(exactUpcoming) && !upcomingShouldBeSuppressed;

  return {
    key: fixture.key,
    label: fixture.label,
    mode: fixture.mode,
    status: releaseExists && upcomingShouldBeSuppressed && !userFacingUpcomingOnly ? 'pass' : 'fail',
    fixture,
    exact_upcoming: exactUpcoming,
    promoted_release: promotedRelease,
    checks: {
      exact_upcoming_present: Boolean(exactUpcoming),
      released_row_present: releaseExists,
      user_facing_upcoming_suppressed: upcomingShouldBeSuppressed,
      upcoming_only_surface_state: userFacingUpcomingOnly,
    },
    missing_requirements: [
      !releaseExists ? 'released_row' : null,
      !upcomingShouldBeSuppressed ? 'upcoming_suppression' : null,
    ].filter(Boolean),
  };
}

function buildAcceptanceFixtureResult(fixture, releases, details, artworkRows, upcomingSignals, referenceDate) {
  const scheduledDate = normalizeDate(fixture.scheduled_date);
  const exactUpcoming = findExactUpcoming(upcomingSignals, fixture);
  const releaseCandidates = buildReleaseCandidates(releases, fixture, scheduledDate);
  const promotedRelease = releaseCandidates[0] ?? null;
  const detail = findDetail(details, promotedRelease);
  const artwork = findArtwork(artworkRows, promotedRelease);
  const promotedReleaseDate = normalizeText(promotedRelease?.release_date);
  const upcomingScheduledDate = normalizeText(exactUpcoming?.scheduled_date);
  const userFacingUpcomingOnly = Boolean(
    exactUpcoming &&
      (!promotedRelease || !promotedReleaseDate || !upcomingScheduledDate || promotedReleaseDate !== upcomingScheduledDate),
  );

  const checks = {
    exact_upcoming_present: Boolean(exactUpcoming),
    released_row_present: Boolean(promotedRelease),
    album_cover_attached: hasArtwork(artwork),
    track_list_attached: hasTrackList(detail),
    official_mv_attached: isPositiveMv(detail) && Boolean(normalizeText(detail?.youtube_video_url)),
    title_track_attached: hasTitleTrack(detail),
    user_facing_not_upcoming_only: !userFacingUpcomingOnly,
  };

  const missingRequirements = [
    !checks.released_row_present ? 'released_row' : null,
    !checks.album_cover_attached ? 'album_cover' : null,
    !checks.track_list_attached ? 'track_list' : null,
    !checks.official_mv_attached ? 'official_mv' : null,
    !checks.title_track_attached ? 'title_track' : null,
    !checks.user_facing_not_upcoming_only ? 'user_surface_suppression' : null,
  ].filter(Boolean);

  return {
    key: fixture.key,
    label: fixture.label,
    mode: fixture.mode,
    status: missingRequirements.length === 0 ? 'pass' : 'fail',
    fixture,
    exact_upcoming: exactUpcoming,
    promoted_release: promotedRelease,
    matched_detail: detail,
    matched_artwork: artwork,
    checks,
    missing_requirements: missingRequirements,
    release_candidates_considered: releaseCandidates.slice(0, 5),
  };
}

function buildFailureUpdateTemplate(referenceDate, results) {
  const failing = results.filter((result) => result.status !== 'pass');
  if (failing.length === 0) {
    return `## same-day acceptance status\n- reference date: ${referenceDate}\n- status: PASS\n- note: YENA suppression and P1Harmony acceptance are both green.`;
  }

  const lines = [
    '## same-day acceptance status',
    `- reference date: ${referenceDate}`,
    '- status: FAIL',
  ];
  for (const result of failing) {
    lines.push(`- fixture: ${result.label}`);
    lines.push(`  - missing: ${result.missing_requirements.join(', ')}`);
    if (result.promoted_release) {
      lines.push(
        `  - promoted release: ${result.promoted_release.release_title} / ${result.promoted_release.release_date} / ${result.promoted_release.stream}`,
      );
    } else {
      lines.push('  - promoted release: none');
    }
  }
  return lines.join('\n');
}

export function buildSameDayReleaseAcceptanceReport(
  {
    releases,
    details,
    artwork,
    upcomingSignals,
  },
  referenceDate,
) {
  const effectiveReferenceDate = normalizeDate(referenceDate) ?? normalizeDate(new Date().toISOString().slice(0, 10));
  const results = SAME_DAY_FIXTURES.map((fixture) =>
    fixture.mode === 'suppression'
      ? buildSuppressionFixtureResult(fixture, releases, upcomingSignals, effectiveReferenceDate)
      : buildAcceptanceFixtureResult(fixture, releases, details, artwork, upcomingSignals, effectiveReferenceDate),
  );
  const overallStatus = results.every((result) => result.status === 'pass') ? 'pass' : 'fail';
  const summaryLines = results.map((result) =>
    result.status === 'pass'
      ? `${result.label}: pass`
      : `${result.label}: fail (${result.missing_requirements.join(', ')})`,
  );

  return {
    generated_at: new Date().toISOString(),
    reference_date: effectiveReferenceDate.toISOString().slice(0, 10),
    overall_status: overallStatus,
    summary_lines: summaryLines,
    fixtures: results,
    failure_update_markdown: buildFailureUpdateTemplate(
      effectiveReferenceDate.toISOString().slice(0, 10),
      results,
    ),
  };
}

export function renderSameDayReleaseAcceptanceMarkdown(report) {
  const lines = [
    '# Same-day Release Acceptance Report',
    '',
    `- generated_at: ${report.generated_at}`,
    `- reference_date: ${report.reference_date}`,
    `- overall_status: ${report.overall_status}`,
    '',
    '## Summary',
    '',
    ...report.summary_lines.map((line) => `- ${line}`),
    '',
    '## Fixtures',
    '',
  ];

  for (const result of report.fixtures) {
    lines.push(`### ${result.label}`);
    lines.push('');
    lines.push(`- status: ${result.status}`);
    lines.push(`- exact upcoming present: ${result.checks.exact_upcoming_present ? 'yes' : 'no'}`);
    lines.push(`- promoted release present: ${result.checks.released_row_present ? 'yes' : 'no'}`);
    if (result.mode === 'acceptance') {
      lines.push(`- album cover attached: ${result.checks.album_cover_attached ? 'yes' : 'no'}`);
      lines.push(`- track list attached: ${result.checks.track_list_attached ? 'yes' : 'no'}`);
      lines.push(`- official MV attached: ${result.checks.official_mv_attached ? 'yes' : 'no'}`);
      lines.push(`- title track attached: ${result.checks.title_track_attached ? 'yes' : 'no'}`);
      lines.push(`- user-facing not upcoming-only: ${result.checks.user_facing_not_upcoming_only ? 'yes' : 'no'}`);
    } else {
      lines.push(`- user-facing upcoming suppressed: ${result.checks.user_facing_upcoming_suppressed ? 'yes' : 'no'}`);
      lines.push(`- upcoming-only surface state: ${result.checks.upcoming_only_surface_state ? 'yes' : 'no'}`);
    }
    lines.push(
      `- missing requirements: ${result.missing_requirements.length ? result.missing_requirements.join(', ') : 'none'}`,
    );
    if (result.promoted_release) {
      lines.push(
        `- promoted release: ${result.promoted_release.release_title} / ${result.promoted_release.release_date} / ${result.promoted_release.stream}`,
      );
    }
    lines.push('');
  }

  lines.push('## Failed-cycle update template');
  lines.push('');
  lines.push('```md');
  lines.push(report.failure_update_markdown);
  lines.push('```');
  lines.push('');
  return `${lines.join('\n')}\n`;
}
