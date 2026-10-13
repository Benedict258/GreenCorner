// Adds the demo projects (the same as Admin > Projects > Add demo projects).
//   npm run seed-demo
// Needs DATABASE_URL and a synced catalog (npm run sync), since each kit uses real products.
import { closePool } from "../src/lib/db";
import { seedDemoProjects } from "../src/lib/admin/projects";

seedDemoProjects()
  .then((n) => console.log(n ? `Added ${n} demo project${n === 1 ? "" : "s"}.` : "The demo projects are already there."))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => closePool());
