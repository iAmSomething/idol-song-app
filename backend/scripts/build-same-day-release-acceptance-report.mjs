#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildSameDayReleaseAcceptanceReport,
  renderSameDayReleaseAcceptanceMarkdown,
} from './lib/sameDayReleaseAcceptance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

const DEFAULT_REPORT_PATH = path.join(BACKEND_DIR, 'reports', 'same_day_release_acceptance_report.json');
const DEFAULT_MARKDOWN_PATH = path.join(BACKEND_DIR, 'reports', 'same_day_release_acceptance_report.md');
const DEFAULT_RELEASES_PATH = path.join(REPO_ROOT, 'group_latest_release_since_2025-06-01_mb.json');
const DEFAULT_DETAILS_PATH = path.join(REPO_ROOT, 'release_detail_catalog.json');
const DEFAULT_ARTWORK_PATH = path.join(REPO_ROOT, 'release_artwork_catalog.json');
const DEFAULT_UPCOMING_PATH = path.join(REPO_ROOT, 'upcoming_release_candidates.json');

function parseArgs(argv) {
  const options = {
    reportPath: DEFAULT_REPORT_PATH,
    markdownPath: DEFAULT_MARKDOWN_PATH,
    releasesPath: DEFAULT_RELEASES_PATH,
    detailsPath: DEFAULT_DETAILS_PATH,
    artworkPath: DEFAULT_ARTWORK_PATH,
    upcomingPath: DEFAULT_UPCOMING_PATH,
    referenceDate: new Date().toISOString().slice(0, 10),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--report-path') {
      options.reportPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--markdown-path') {
      options.markdownPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--releases-path') {
      options.releasesPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--details-path') {
      options.detailsPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--artwork-path') {
      options.artworkPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--upcoming-path') {
      options.upcomingPath = path.resolve(REPO_ROOT, argv[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (value === '--reference-date') {
      options.referenceDate = String(argv[index + 1] ?? '').trim();
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return options;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [releases, details, artwork, upcomingSignals] = await Promise.all([
    loadJson(options.releasesPath),
    loadJson(options.detailsPath),
    loadJson(options.artworkPath),
    loadJson(options.upcomingPath),
  ]);

  const report = buildSameDayReleaseAcceptanceReport(
    {
      releases,
      details,
      artwork,
      upcomingSignals,
    },
    options.referenceDate,
  );
  const markdown = renderSameDayReleaseAcceptanceMarkdown(report);

  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await mkdir(path.dirname(options.markdownPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(options.markdownPath, markdown, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

await main();
