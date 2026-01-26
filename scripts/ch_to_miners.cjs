// scripts/ch_to_miners.cjs
// Usage: node scripts/ch_to_miners.cjs

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const HEROES_URL = "https://clickerheroes.fandom.com/wiki/Heroes";

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "galactic-digger-json-generator/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return await res.text();
}

const MINER_NAMES = [
  "Pebble Tapper",
  "Dust Driller",
  "Crater Pocker",
  "Moon Knocker",
  "Tap Comet",
  "Tiny Drill",
  "Chisel Bot",
  "Ore Runner",
  "Tap Specialist",
  "Tap Captain",
  "Rock Grinder",
  "Crust Borer",
  "Ore Chef",
  "Lava Driller",
  "Canyon Ripper",
  "Crystal Cutter",
  "Iron Hound",
  "Tectonic Twin",
  "Deep Core Kid",
  "Quartz Queen",
  "Basalt Baron",
  "Meteor Mason",
  "Nimbus Nibbler",
  "Obsidian Owl",
  "Cobalt Captain",
  "Tap & Drill Duo",
  "Rubble Raptor",
  "Shale Shredder",
  "Tap Reactor",
  "Core Maestro",
  "Nebula Engineer",
  "Starlight Foreman",
  "Void Harvester",
  "Orbit Supervisor",
  "Quantum Digger",
  "Asteroid Artisan",
  "Solar Sapper",
  "Galaxy Golem",
  "Tap Titan",
  "Star Founder",
  "Nova Nurse",
  "Comet Accountant",
  "Gravity Gardener",
  "Singularity Smith",
  "Aurora Admiral",
  "Cosmic CFO",
  "Crit Conductor",
  "Tap Oracle",
  "Mineral Magnet",
  "Endgame Excavator",
  // +4 yeni
  "Nebula Warden",
  "Quasar Architect",
  "Chrono Ranger",
  "Void Scout",
];

function normalizeNumber(text) {
  const t = String(text || "")
    .replaceAll(",", "")
    .trim();
  if (!t || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function mapPercentToValue(text) {
  const t = String(text || "")
    .replaceAll(",", "")
    .trim();
  if (!t || t === "-") return null;

  const num = Number(t.replace("%", "").replace("+", ""));
  if (!Number.isFinite(num)) return null;

  return num / 100; // +1900% => 19.0
}

function parseHeroFromRow($, row) {
  const $row = $(row);
  const tds = $row.find("td");
  if (tds.length < 5) return null;

  const heroLink = $row.find("td").first().find("a").first();
  const heroName = heroLink.text().trim();
  const href = heroLink.attr("href");
  const heroUrl = href ? "https://clickerheroes.fandom.com" + href : null;

  const baseCost = normalizeNumber($(tds[2]).text());
  const baseDps = normalizeNumber($(tds[3]).text());

  const personal = $(tds[4]).text().trim();
  const global = $(tds[5]).text().trim();
  const click = $(tds[6]).text().trim();
  const critChance = $(tds[7]).text().trim();
  const critMult = $(tds[8]).text().trim();
  const gold = $(tds[9]).text().trim();
  const unlock = $(tds[10]).text().trim();

  return {
    heroName,
    heroUrl,
    baseCost,
    baseDps,
    bonusCols: { personal, global, click, critChance, critMult, gold, unlock },
  };
}

// CH: son 4 hero (Ace Scouts) costGrowth 1.22, diğerleri 1.07
function costGrowthForIndex(i, total) {
  const last4Start = Math.max(0, total - 4);
  return i >= last4Start ? 1.22 : 1.07;
}

function buildSkillsFromBonusCols(b) {
  const skills = [];

  const personal = mapPercentToValue(b.personal);
  if (personal != null)
    skills.push({
      id: "ch_personal",
      name: "Personal Boost",
      kind: "dpsMultiplier",
      value: personal,
      unlockAt: 10,
    });

  const global = mapPercentToValue(b.global);
  if (global != null)
    skills.push({
      id: "ch_global",
      name: "Global Boost",
      kind: "globalDpsMultiplier",
      value: global,
      unlockAt: 25,
    });

  const click = mapPercentToValue(b.click);
  if (click != null)
    skills.push({
      id: "ch_click",
      name: "Click Boost",
      kind: "tapMultiplier",
      value: click,
      unlockAt: 50,
    });

  const critChance = mapPercentToValue(b.critChance);
  if (critChance != null)
    skills.push({
      id: "ch_critChance",
      name: "Crit Chance",
      kind: "critChance",
      value: critChance,
      unlockAt: 75,
    });

  const critMult = mapPercentToValue(b.critMult);
  if (critMult != null)
    skills.push({
      id: "ch_critMult",
      name: "Crit Power",
      kind: "critMultiplier",
      value: critMult,
      unlockAt: 100,
    });

  const gold = mapPercentToValue(b.gold);
  if (gold != null)
    skills.push({
      id: "ch_gold",
      name: "Mineral Gain",
      kind: "mineralMultiplier",
      value: gold,
      unlockAt: 125,
    });

  if (b.unlock && b.unlock !== "-") {
    skills.push({
      id: "ch_unlock",
      name: `Unlock: ${b.unlock}`,
      kind: "meta",
      value: b.unlock,
      unlockAt: 150,
    });
  }

  return skills;
}

async function getHeroesTableData() {
  const html = await fetchHtml(HEROES_URL);
  const $ = cheerio.load(html);

  let rows = [];
  $("table").each((_, table) => {
    const head = $(table).find("tr").first().text();
    if (!head.includes("Hero Name") || !head.includes("Base Cost")) return;

    $(table)
      .find("tr")
      .slice(1)
      .each((__, tr) => {
        const r = parseHeroFromRow($, tr);
        if (r && r.heroName) rows.push(r);
      });
  });

  // uniq
  const seen = new Set();
  const uniq = [];
  for (const r of rows) {
    if (seen.has(r.heroName)) continue;
    seen.add(r.heroName);
    uniq.push(r);
  }
  return uniq;
}

async function main() {
  const heroes = await getHeroesTableData();

  if (heroes.length < 54) {
    console.warn(
      `WARN: heroes found=${heroes.length}. Expecting 54. Wiki layout may have changed.`,
    );
  }

  const total = Math.min(heroes.length, MINER_NAMES.length);

  const miners = [];
  for (let i = 0; i < total; i++) {
    const h = heroes[i];
    const id = `miner_${String(i + 1).padStart(2, "0")}`;

    // CH’de çoğu DPS hero. Cid tarzı click hero için baseDps null kalabilir ama
    // tabloda baseDps 0 gelebilir; burada basit ayrım:
    const dpsBase = Number(h.baseDps || 0);
    const isClickHero = dpsBase === 0; // kaba kural (V2’de cid’i isimden yakalarız)
    const stats = isClickHero
      ? { tapBase: 1, dpsBase: 0 }
      : { tapBase: 0, dpsBase };

    miners.push({
      id,
      name: MINER_NAMES[i],
      sprite: "miner_01.png",
      baseCost: h.baseCost ?? 0,
      costGrowth: costGrowthForIndex(i, total),
      stats,
      skills: buildSkillsFromBonusCols(h.bonusCols || {}),
      _ch: { heroName: h.heroName, heroUrl: h.heroUrl },
    });
  }

  const outPath = path.join(process.cwd(), "assets", "config", "miners.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(miners, null, 2), "utf-8");

  console.log(`OK: wrote ${miners.length} miners -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
