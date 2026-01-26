/**
 * tools/apply_ch_costs.js
 * - Mevcut miners.json'ı okur
 * - SIRAYLA miner_01..miner_50 => CH baseCost dizisini basar
 * - costGrowth = 1.07 yapar (CH level-up cost büyümesi ile uyumlu)
 * - scaling.perLevel'ı istersen 1.07 yapar (varsa)
 */

const fs = require("fs");
const path = require("path");

const INPUT = path.join(__dirname, "..", "assets", "config", "miners.json");
const OUTPUT = path.join(__dirname, "..", "assets", "config", "miners.json"); // aynı dosyanın üstüne yazar

const BASE_COSTS_50 = [
  "5",
  "50",
  "250",
  "1000",
  "4000",
  "20",
  "100",
  "400",
  "2,500,000",
  "15,000,000",
  "100,000,000",
  "800,000,000",
  "6,500,000,000",
  "50,000,000,000",
  "4,50E+14",
  "4,00E+15",
  "3,60E+16",
  "3,20E+17",
  "2,70E+18",
  "2,40E+19",
  "3,00E+20",
  "9,00E+21",
  "3,50E+23",
  "1,40E+25",
  "4,20E+27",
  "2,10E+30",
  "1,00E+43",
  "1,00E+58",
  "1,00E+73",
  "1,00E+88",
  "1,00E+103",
  "1,00E+118",
  "1,00E+133",
  "1,00E+148",
  "1,00E+163",
  "1,00E+178",
  "1,00E+193",
  "1,00E+208",
  "1,00E+223",
  "1,00E+238",
  "1.000e500",
  "1.000e1000",
  "1.000e2000",
  "1.000e4000",
  "1.000e8000",
  "1.000e14000",
  "1.000e25500",
  "1.000e25500",
  "1.000e45500",
  "1.000e72000",
  "1.000e108000",
  "1.000e114500",
  "1.000e127500",
  "1.000e142200",
];

function main() {
  const raw = fs.readFileSync(INPUT, "utf8");
  const miners = JSON.parse(raw);

  if (!Array.isArray(miners)) {
    throw new Error("miners.json array olmalı.");
  }
  if (miners.length < 50) {
    throw new Error(
      `miners.json en az 50 miner içermeli. Şu an: ${miners.length}`,
    );
  }

  const out = miners.map((m, i) => {
    const idx = i; // 0-based
    if (idx < 54) {
      const baseCost = BASE_COSTS_50[idx];

      // costGrowth: CH hissi için 1.07
      const costGrowth = 1.07;

      // scaling.perLevel: istersen CH DPS eğrisiyle uyumlu 1.07 (scaling objesi varsa)
      const scaling = m.scaling ? { ...m.scaling, perLevel: 1.07 } : m.scaling;

      return {
        ...m,
        baseCost,
        costGrowth,
        ...(scaling ? { scaling } : {}),
      };
    }

    // 50 üstü varsa dokunma (şimdilik)
    return m;
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), "utf8");
  console.log("OK: miners.json -> CH baseCost + costGrowth(1.07) uygulandı.");
}

main();
