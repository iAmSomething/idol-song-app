import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_SERVICES_PATH = path.resolve(__dirname, '../firebase/google-services.production.json');
const EXPECTED_PACKAGE_NAME = 'com.anonymous.idolsongappmobile';

const raw = JSON.parse(readFileSync(GOOGLE_SERVICES_PATH, 'utf8'));
const packageName = raw?.client?.[0]?.client_info?.android_client_info?.package_name ?? null;
const mobileSdkAppId = raw?.client?.[0]?.client_info?.mobilesdk_app_id ?? null;
const projectNumber = raw?.project_info?.project_number ?? null;

if (packageName !== EXPECTED_PACKAGE_NAME) {
  throw new Error(
    `google-services.production.json package mismatch: expected ${EXPECTED_PACKAGE_NAME}, received ${packageName ?? 'null'}`,
  );
}

if (!mobileSdkAppId) {
  throw new Error('google-services.production.json is missing mobilesdk_app_id');
}

if (!projectNumber) {
  throw new Error('google-services.production.json is missing project_number');
}

console.log(
  JSON.stringify(
    {
      status: 'pass',
      package_name: packageName,
      mobilesdk_app_id: mobileSdkAppId,
      project_number: projectNumber,
      source: GOOGLE_SERVICES_PATH,
    },
    null,
    2,
  ),
);
