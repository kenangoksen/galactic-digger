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
  5, 28, 152, 835, 4595, 25302, 139314, 767064, 4.223e6, 2.325e7,
  1.28e8, 7.05e8, 3.882e9, 2.137e10, 1.177e11, 6.479e11, 3.568e12, 1.964e13, 1.082e14, 5.955e14,
  3.279e15, 1.805e16, 9.94e16, 5.473e17, 3.013e18, 1.659e19, 9.136e19, 5.03e20, 2.77e21, 1.525e22,
  8.396e22, 4.623e23, 2.545e24, 1.402e25, 7.717e25, 4.249e26, 2.339e27, 1.288e28, 7.092e28, 3.905e29,
  2.15e30, 1.184e31, 6.518e31, 3.589e32, 1.976e33, 1.088e34, 5.991e34, 3.299e35, 1.816e36, 1.0e37,
];

function main() {
  const raw = fs.readFileSync(INPUT, "utf8");
  const miners = JSON.parse(raw);

  if (!Array.isArray(miners)) {
    throw new Error("miners.json array olmalı.");
  }
  if (miners.length < 50) {
    throw new Error(`miners.json en az 50 miner içermeli. Şu an: ${miners.length}`);
  }

  const out = miners.map((m, i) => {
    const idx = i; // 0-based
    if (idx < 50) {
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
