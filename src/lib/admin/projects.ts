import { query, queryOne, tx } from "../db";
import { slugify, SUPPLIER } from "../store/catalog";
import type { ProjectDownload, ProjectStep } from "../store/projects";

export interface ProjectInput {
  title: string;
  slug: string;
  summary: string;
  description: string;
  learn: string[];
  level: string;
  ageGroup: string;
  topics: string[];
  buildTime: string;
  imageUrl: string | null;
  videoUrl: string | null;
  steps: ProjectStep[];
  safety: string;
  downloads: ProjectDownload[];
  published: boolean;
  position: number;
  items: { ref: string; quantity: number }[];
}

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

export function validateProject(p: ProjectInput): string | null {
  if (p.title.trim().length < 3) return "Give the project a title.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) return "The page address may use only lowercase letters, numbers and dashes.";
  if (!LEVELS.includes(p.level)) return "Pick a level.";
  for (const i of p.items) if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 1000) return "Each component quantity must be a whole number from 1 to 1000.";
  const urls = [p.imageUrl, p.videoUrl, ...p.downloads.map((d) => d.url), ...p.steps.map((s) => s.image)].filter(Boolean) as string[];
  for (const u of urls) if (!/^(https:\/\/|\/media\/|\/images\/)/.test(u)) return `Links must start with https:// (or be an uploaded file): ${u}`;
  return null;
}

/** Saves a project (new when id is null) and its kit list. Returns the id. */
export async function saveProject(id: number | null, p: ProjectInput): Promise<number> {
  const err = validateProject(p);
  if (err) throw new Error(err);
  return tx(async (c) => {
    const clash = (await c.query("select id from projects where slug = $1 and id is distinct from $2", [p.slug, id])).rows[0];
    if (clash) throw new Error("Another project already uses that page address.");
    const vals = [p.title.trim(), p.slug, p.summary.trim(), p.description.trim(), JSON.stringify(p.learn.filter(Boolean)), p.level, p.ageGroup.trim(), p.topics, p.buildTime.trim(), p.imageUrl, p.videoUrl, JSON.stringify(p.steps.filter((s) => s.title.trim() || s.text.trim())), p.safety.trim(), JSON.stringify(p.downloads.filter((d) => d.label.trim() && d.url.trim())), p.published, p.position];
    let pid = id;
    if (pid === null) {
      pid = (await c.query(
        `insert into projects (title, slug, summary, description, learn, level, age_group, topics, build_time, image_url, video_url, steps, safety, downloads, published, position)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning id`,
        vals,
      )).rows[0].id as number;
    } else {
      const r = await c.query(
        `update projects set title = $1, slug = $2, summary = $3, description = $4, learn = $5, level = $6, age_group = $7, topics = $8, build_time = $9,
           image_url = $10, video_url = $11, steps = $12, safety = $13, downloads = $14, published = $15, position = $16, updated_at = now() where id = $17`,
        [...vals, pid],
      );
      if (!r.rowCount) throw new Error("That project no longer exists.");
    }
    await c.query("delete from project_items where project_id = $1", [pid]);
    let pos = 0;
    for (const i of p.items) {
      await c.query(
        "insert into project_items (project_id, supplier, ref, quantity, position) values ($1, $2, $3, $4, $5) on conflict (project_id, supplier, ref) do update set quantity = project_items.quantity + excluded.quantity",
        [pid, SUPPLIER, i.ref, i.quantity, pos++],
      );
    }
    return pid as number;
  });
}

export async function deleteProject(id: number): Promise<void> {
  await query("delete from projects where id = $1", [id]);
}

export async function setPublished(id: number, published: boolean): Promise<void> {
  await query("update projects set published = $2, updated_at = now() where id = $1", [id, published]);
}

/** Product search for the kit editor (admin sees every product, hidden or not). */
export async function findProducts(q: string, limit = 12) {
  if (q.trim().length < 2) return [];
  return query(
    `select p.id, p.ref, p.title, p.price_ngn, p.in_stock, coalesce(ps.hidden, false) as hidden from supplier_products p
     left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
     where p.supplier = $1 and (p.title ilike $2 or p.ref ilike $2) order by p.price_ngn is null, p.position limit $3`,
    [SUPPLIER, `%${q.trim()}%`, limit],
  );
}

// Uploaded images and PDFs for projects live in the database (no extra storage service to set up).
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
export const MEDIA_MAX = 3 * 1024 * 1024;

export async function saveMedia(name: string, mime: string, bytes: Buffer): Promise<string> {
  if (!MEDIA_TYPES.includes(mime)) throw new Error("Upload a JPG, PNG, WebP or GIF image, or a PDF.");
  if (bytes.length > MEDIA_MAX) throw new Error("Files must be 3 MB or smaller. Resize the photo and try again.");
  const r = await queryOne("insert into media (mime, bytes, name) values ($1, $2, $3) returning id", [mime, bytes, name.slice(0, 200)]);
  return `/media/${r.id}`;
}

// Demo projects ---------------------------------------------------------------------------------------

interface DemoItem { find: string[]; quantity: number }
interface Demo { title: string; summary: string; description: string; learn: string[]; level: string; age: string; topics: string[]; time: string; steps: ProjectStep[]; safety: string; items: DemoItem[] }

/** Placeholder projects so the Projects page is not empty. Each kit part is the first in-stock product whose title matches. */
const DEMOS: Demo[] = [
  {
    title: "Solar phone charger", level: "Beginner", age: "Secondary", topics: ["Solar"], time: "2 hours",
    summary: "Charge a phone from the sun using a solar panel and a Li-ion cell.",
    description: "A small solar charger that stores the sun's energy in a rechargeable cell and gives it back through a USB port, so you can top up a phone or a power bank.\n\nYou will wire the panel to a charging module, fit the cell, add a switch and a boost module, then test it in real sunlight.",
    learn: ["How a solar panel turns sunlight into electricity", "How to charge and protect a Li-ion cell safely", "What voltage and current are, and how to measure them", "Why solar systems store energy in batteries"],
    steps: [
      { title: "Test the solar panel", text: "Put the panel in direct sunlight and measure the voltage across its wires with a multimeter." },
      { title: "Connect the charger module", text: "Join the panel to the IN+ and IN- pads of the charger module, and the battery holder to B+ and B-." },
      { title: "Add the boost module", text: "The boost module turns the cell voltage into a steady 5V for the USB port." },
      { title: "Test it and charge a phone", text: "Leave the panel in the sun until the module's light changes, then plug in a phone." },
    ],
    safety: "Li-ion cells can get hot if their terminals touch or if they are put in backwards. Check polarity every time.\nCharge cells only through the charger module.",
    items: [{ find: ["solar panel", "solar cell"], quantity: 1 }, { find: ["tp4056"], quantity: 1 }, { find: ["18650"], quantity: 1 }, { find: ["boost", "step up", "step-up"], quantity: 1 }, { find: ["jumper wire", "jumper"], quantity: 1 }],
  },
  {
    title: "Bottle lantern", level: "Beginner", age: "Primary and secondary", topics: ["Lighting", "Recycling"], time: "1 hour",
    summary: "The Waste2Light classic: a rechargeable lantern inside a recycled bottle.",
    description: "Turn a used plastic bottle into a rechargeable study lantern, the project Waste2Light started with.\n\nA small cell powers bright LEDs; a charger module tops it up from any USB charger.",
    learn: ["How LEDs make light from very little power", "How a rechargeable cell is charged safely", "How waste can become something useful"],
    steps: [{ title: "Prepare the bottle", text: "Clean a clear plastic bottle and cut a small opening for the switch." }, { title: "Wire the LEDs", text: "Connect the LEDs through the switch to the battery holder." }, { title: "Add the charger", text: "Fit the charger module so the lantern can be charged by USB." }],
    safety: "Ask an adult to help when cutting the bottle.\nNever short the battery terminals.",
    items: [{ find: ["led"], quantity: 4 }, { find: ["tp4056"], quantity: 1 }, { find: ["18650"], quantity: 1 }, { find: ["switch"], quantity: 1 }],
  },
  {
    title: "Smart dustbin", level: "Intermediate", age: "Secondary", topics: ["Sensors", "Robotics"], time: "3 hours",
    summary: "A lid that opens by itself when your hand comes near.",
    description: "An ultrasonic sensor measures how far your hand is; when it comes close, an Arduino tells a servo motor to lift the lid.",
    learn: ["How an ultrasonic sensor measures distance", "How to program an Arduino", "How a servo motor moves to an exact angle"],
    steps: [{ title: "Wire the sensor", text: "Connect the ultrasonic sensor to the Arduino's 5V, GND and two digital pins." }, { title: "Wire the servo", text: "Connect the servo to 5V, GND and a PWM pin." }, { title: "Upload the code", text: "Upload the sketch and adjust the distance until the lid opens at the right moment." }],
    safety: "Keep fingers clear of the lid hinge while testing.",
    items: [{ find: ["arduino uno", "uno"], quantity: 1 }, { find: ["ultrasonic", "hc-sr04"], quantity: 1 }, { find: ["servo", "sg90"], quantity: 1 }, { find: ["jumper wire", "jumper"], quantity: 1 }],
  },
  {
    title: "Mini wind turbine generator", level: "Intermediate", age: "Secondary and university", topics: ["Wind"], time: "3 hours",
    summary: "Spin a small motor with the wind and light an LED.",
    description: "A DC motor works backwards as a generator: turn its shaft and it makes electricity. Add blades and catch the wind.",
    learn: ["How a generator turns movement into electricity", "Why blade shape matters", "How to measure the power you make"],
    steps: [{ title: "Fit the blades", text: "Fix the blades to the motor shaft so they spin freely." }, { title: "Connect the LED", text: "Wire the LED to the motor terminals and spin the blades." }],
    safety: "Spinning blades can hurt. Keep hands clear when testing in strong wind.",
    items: [{ find: ["dc motor", "motor"], quantity: 1 }, { find: ["led"], quantity: 2 }, { find: ["multimeter"], quantity: 1 }],
  },
];

async function pick(find: string[]): Promise<string | null> {
  for (const f of find) {
    const r = await queryOne(
      `select p.ref from supplier_products p left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
       where p.supplier = $1 and p.title ilike $2 and p.price_ngn is not null and p.in_stock is not false and not coalesce(ps.hidden, false)
       order by length(p.title), p.position limit 1`,
      [SUPPLIER, `%${f}%`],
    );
    if (r) return r.ref;
  }
  return null;
}

/** Adds the demo projects that do not exist yet. Returns how many were added. */
export async function seedDemoProjects(): Promise<number> {
  let added = 0;
  let pos = (await queryOne("select coalesce(max(position), 0) as p from projects"))?.p ?? 0;
  for (const d of DEMOS) {
    const slug = slugify(d.title);
    if (await queryOne("select 1 from projects where slug = $1", [slug])) continue;
    const items: { ref: string; quantity: number }[] = [];
    for (const it of d.items) {
      const ref = await pick(it.find);
      if (ref && !items.some((x) => x.ref === ref)) items.push({ ref, quantity: it.quantity });
    }
    await saveProject(null, {
      title: d.title, slug, summary: d.summary, description: d.description, learn: d.learn, level: d.level, ageGroup: d.age, topics: d.topics,
      buildTime: d.time, imageUrl: null, videoUrl: null, steps: d.steps, safety: d.safety, downloads: [], published: true, position: ++pos, items,
    });
    added++;
  }
  return added;
}
