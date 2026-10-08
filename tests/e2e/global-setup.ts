import { startUcampus } from './ucampus';
import { sql } from './database';
import { removeTestData } from './test-data';

// Fixture teardown cannot run after a hard interruption (Ctrl-C, global timeout,
// crashed worker). Only one invocation runs at a time, so leftovers are orphans.
export default async function removeOrphanedTestData() {
  if ((await sql(`SELECT to_regclass('"RoadmapNotice"') IS NULL;`)) !== 't') {
    await removeTestData('orphans');
  }
  return startUcampus();
}
