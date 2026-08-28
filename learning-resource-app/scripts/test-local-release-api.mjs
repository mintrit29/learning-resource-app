import path from 'node:path';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runReleaseApiRegression} from './release-api-regression.mjs';
// Explicit opt-in to the disposable profile, never accept a user/library URL.
const root=path.resolve('../.tmp/release-qa-20260828/profile');
assert.equal(process.env.SCHOLARFLOW_QA_PROFILE,root,'Set SCHOLARFLOW_QA_PROFILE to the isolated QA profile');
const log=await readFile(path.join(root,'logs/desktop.log'),'utf8');
const origin=[...log.matchAll(/Khởi động ScholarFlow tại (http:\/\/127\.0\.0\.1:\d+)/g)].at(-1)?.[1];
assert.ok(origin);
await runReleaseApiRegression(origin);
