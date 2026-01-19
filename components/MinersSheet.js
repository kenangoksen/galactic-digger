// components/MinersSheet.js
import { memo, useMemo, useRef } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { fmt } from "../game/damage";

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

function minerDpsPerLevel(miner) {
  return Number(miner?.stats?.dpsBase || 0);
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
  const canBuy = minerals >= cost;

  const action = level <= 0 ? "BUY" : "LVL UP";

  const dpsPerLvl = minerDpsPerLevel(miner);
  const totalDps = dpsPerLvl * Math.max(1, level);
  const dpsLine = dpsPerLvl > 0 ? `${fmt(totalDps)} DPS` : "—";

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
            {fmt(cost)}
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
}) {
  const listRef = useRef(null);

  const data = useMemo(() => miners, [miners]);

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
    top: -10,
    right: 10,
    zIndex: 50,
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeChevronTxt: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    fontWeight: "900",
    marginTop: -2,
  },

  list: { paddingTop: 10, paddingBottom: 14 },

  rowWrap: { paddingHorizontal: 10, paddingVertical: 6 },

  row: { flexDirection: "row", alignItems: "center", gap: 10 },

  icon: { width: 34, height: 34, borderRadius: 9 },

  mid: { flex: 1, minWidth: 0 },

  name: { color: "rgba(255,255,255,0.95)", fontWeight: "900", fontSize: 13 },
  level: { color: "rgba(255,255,255,0.55)", fontWeight: "900", fontSize: 12 },
  subLine: { marginTop: 2, color: "rgba(255,255,255,0.58)", fontWeight: "800", fontSize: 12 },

  btn: {
    width: 84,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(255,235,195,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { backgroundColor: "rgba(255,255,255,0.08)" },
  btnTxt: { fontWeight: "900", color: "#14141C", fontSize: 11, lineHeight: 13 },
  btnCost: { marginTop: 2, fontWeight: "900", color: "#14141C", fontSize: 11, lineHeight: 13 },
  btnTxtDisabled: { color: "rgba(255,255,255,0.55)" },

  skillStrip: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },

  skillDot: {
    width: 28,
    height: 28,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  skillDotLocked: { opacity: 0.28 },
  skillDotOwned: {
    borderColor: "rgba(140,255,180,0.35)",
    backgroundColor: "rgba(140,255,180,0.10)",
  },
  skillDotIcon: { fontSize: 13 },

  divider: { marginTop: 10, height: 1, backgroundColor: "rgba(255,255,255,0.07)" },
});
