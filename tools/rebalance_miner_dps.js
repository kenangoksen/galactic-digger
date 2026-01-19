/**
 * node scripts/rebalance_miners_dps.js
 * miners.json içindeki dpsBase değerlerini cost'a göre yeniden hesaplar.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "assets", "config", "miners.json");

// CH örneğinden fit edilmiş sabitler
const A = 0.2571413399885573;
const P = 0.8321908748719181;

// IDLE odaklı hız çarpanı (oynanış hızını buradan ayarlarsın)
const IDLE_TUNE = 1.8;

function calcDps(baseCost) {
  const c = Number(baseCost || 0);
  if (c <= 0) return 0;
  const raw = IDLE_TUNE * A * Math.pow(c, P);
  // minimum 1 dps (çok erken minerlerde 0'a düşmesin)
  return Math.max(1, Math.round(raw));
}

const miners = JSON.parse(fs.readFileSync(filePath, "utf8"));

const out = miners.map((m) => {
  const id = m.id;

  // miner_01: sadece tap hero kalsın
  if (id === "miner_01") {
    return {
      ...m,
      stats: {
        ...(m.stats || {}),
        tapBase: Number(m.stats?.tapBase || 0), // sende 4
        dpsBase: 0,
      },
    };
  }

  // diğerleri: tapBase sıfır, dpsBase hesapla
  const baseCost = Number(m.baseCost || 0);
  const dpsBase = calcDps(baseCost);

  return {
    ...m,
    stats: {
      ...(m.stats || {}),
      tapBase: 0,
      dpsBase,
    },
  };
});

fs.writeFileSync(filePath, JSON.stringify(out, null, 2), "utf8");
console.log("✅ miners.json dpsBase rebalanced with IDLE_TUNE =", IDLE_TUNE);