import "dotenv/config";
import { pool } from "../config/db";

async function main() {
  await pool.query("alter table segments add column if not exists street_m real");
  await pool.query("alter table segments add column if not exists neighbors int");
  const { rows } = await pool.query("select min(id) as lo, max(id) as hi from segments");
  const lo = Number(rows[0].lo);
  const hi = Number(rows[0].hi);

  console.log("Step 1: street length nearby (5-15 minutes)");
  const STEP = 2000;
  for (let a = lo; a <= hi; a += STEP) {
    await pool.query(
      `update segments s set street_m = (
         select coalesce(sum(o.length_m), 0) from segments o
         where o.id <> s.id and ST_DWithin(o.geom, s.geom, 0.001)
       ) where s.id >= $1 and s.id < $2`,
      [a, a + STEP]
    );
    console.log(`  up to id ${Math.min(a + STEP, hi)} / ${hi}`);
  }

  console.log("Step 2: rank 0-99");
  const p = await pool.query(
    `select percentile_cont(array(select (g / 100.0)::float8 from generate_series(1, 99) g))
            within group (order by street_m) as cuts
     from segments`
  );
  const cuts: number[] = p.rows[0].cuts;

  const BIG = 20000;
  for (let a = lo; a <= hi; a += BIG) {
    await pool.query(
      `update segments set neighbors = width_bucket(street_m::float8, $1::float8[])
       where id >= $2 and id < $3`,
      [cuts, a, a + BIG]
    );
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});