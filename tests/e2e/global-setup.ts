import { startUcampus } from './ucampus';
import { sql } from './database';
import { removeTestData } from './test-data';

export default async function removeOrphanedTestData() {
  if ((await sql(`SELECT to_regclass('"RoadmapNotice"') IS NULL;`)) !== 't') {
    await removeTestData('orphans');
  }
  return startUcampus();
}
