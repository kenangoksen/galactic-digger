// components/MinersSheet.js
import { memo, useMemo, useRef } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { D, fmtD } from "../game/bn";

console.log("MINERSHEET FILE: components/MinersSheet.js loaded");

const MINER_PLACEHOLDER = require("../assets/images/sprites/miners/miner_01.png");

function skillIcon(kind) {
  switch (kind) {
    case "tapMultiplier":
      return "👆";
    case "dpsMultiplier":
      return "⚙️";
    case "globalDpsMultiplier":
      return "📈";
    case "critChance":
      return "🎯";
    case "critMultiplier":
      return "💥";
    case "mineralMultiplier":
      return "⛏️";
    default:
      return "✨";
  }
}

// Decimal-safe: dpsBase string/number/Decimal olabilir
function minerDpsPerLevel(miner) {
  return miner?.stats?.dpsBase ?? 0;
}

const MinerRow = memo(function MinerRow({
  miner,
  level,
  minerals,
  getNextCost,
  onBuyOrUpgrade,
  purchasedSkillsForMiner,
}) {
  const cost = getNextCost(miner, level);

  // Decimal-safe compare
  const canBuy = D(minerals).gte(cost);

  const action = level <= 0 ? "BUY" : "LVL UP";

  const dpsPerLvl = minerDpsPerLevel(miner);

  // totalDps = dpsPerLvl * level (en az 1)
  const totalDps = D(dpsPerLvl).mul(Math.max(1, level));

  const dpsLine = D(dpsPerLvl).gt(0) ? `${fmtD(totalDps)} DPS` : "—";

  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <Image source={MINER_PLACEHOLDER} style={styles.icon} />

        <View style={styles.mid}>
          <Text numberOfLines={1} style={styles.name}>
            {miner.name} <Text style={styles.level}>LVL {level}</Text>
          </Text>
          <Text style={styles.subLine}>{dpsLine}</Text>
        </View>

        <Pressable
          onPress={() => onBuyOrUpgrade(miner.id)}
          disabled={!canBuy}
          style={[styles.btn, !canBuy && styles.btnDisabled]}
        >
          <Text style={[styles.btnTxt, !canBuy && styles.btnTxtDisabled]}>
            {action}
          </Text>
          <Text style={[styles.btnCost, !canBuy && styles.btnTxtDisabled]}>
            {fmtD(cost)}
          </Text>
        </Pressable>
      </View>

      {!!(miner.skills && miner.skills.length) && (
        <View style={styles.skillStrip}>
          {miner.skills.map((sk) => {
            const unlocked = level >= Number(sk.unlockAt || 0);
            const purchased = !!purchasedSkillsForMiner?.[sk.id];

            return (
              <View
                key={sk.id}
                style={[
                  styles.skillDot,
                  !unlocked && styles.skillDotLocked,
                  purchased && styles.skillDotOwned,
                ]}
              >
                <Text style={styles.skillDotIcon}>{skillIcon(sk.kind)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.divider} />
    </View>
  );
});

function MinersSheetImpl({
  miners = [],
  owned = {},
  ownedSkills = {},
  minerals = 0,
  getNextCost,
  onBuyOrUpgrade,
  onClose,
  unlockedCount = 2,
}) {
  const listRef = useRef(null);

  const data = useMemo(() => {
    const count = Math.max(2, Number(unlockedCount || 2));
    return miners.slice(0, Math.min(count, miners.length));
  }, [miners, unlockedCount]);

  return (
    <View style={styles.sheet} pointerEvents="auto">
      <Pressable onPress={onClose} style={styles.closeChevron} hitSlop={12}>
        <Text style={styles.closeChevronTxt}>⌄</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        renderItem={({ item: m }) => {
          const lvl = Number(owned[m.id] || 0);
          const purchasedMap = ownedSkills?.[m.id] || {};
          return (
            <MinerRow
              miner={m}
              level={lvl}
              minerals={minerals}
              getNextCost={getNextCost}
              onBuyOrUpgrade={onBuyOrUpgrade}
              purchasedSkillsForMiner={purchasedMap}
            />
          );
        }}
      />
    </View>
  );
}

export default memo(MinersSheetImpl);

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 74,
    height: 300,
    borderRadius: 16,
    backgroundColor: "rgba(10,10,14,0.93)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },

  closeChevron: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  closeChevronTxt: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 22,
    lineHeight: 22,
  },

  list: {
    paddingTop: 18,
    paddingBottom: 18,
  },

  rowWrap: {
    paddingHorizontal: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  icon: {
    width: 44,
    height: 44,
    resizeMode: "contain",
    marginRight: 10,
  },

  mid: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  name: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  level: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
  },

  subLine: {
    marginTop: 3,
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },

  btn: {
    width: 92,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(96, 165, 250, 0.95)",
    alignItems: "center",
    justifyContent: "center",
  },

  btnDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  btnTxt: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  btnTxtDisabled: {
    color: "rgba(255,255,255,0.35)",
  },

  btnCost: {
    marginTop: 2,
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },

  skillStrip: {
    flexDirection: "row",
    paddingLeft: 54,
    paddingRight: 12,
    paddingBottom: 10,
    flexWrap: "wrap",
    gap: 6,
  },

  skillDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  skillDotLocked: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  skillDotOwned: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
  },

  skillDotIcon: {
    color: "white",
    fontSize: 12,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 54,
  },
});
