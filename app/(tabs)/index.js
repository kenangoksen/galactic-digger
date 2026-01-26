// app/(tabs)/index.js
import { Alert, ImageBackground, StyleSheet, View } from "react-native";

import BottomNav from "../../components/BottomNav";
import MinersSheet from "../../components/MinersSheet";
import TopBar from "../../components/TopBar";

import { fmt, getNextCost } from "../../game/damage";
import { useGameEngine } from "../../game/useGameEngine";
import { useStageAnims } from "../../game/useStageAnims";

import GameStage from "../../components/game/GameStage";
import MinersSheetHost from "../../components/game/MinersSheetHost";

import minersDef from "../../assets/config/miners.json";
import SideBarLeft from "../../components/SideBarLeft";
import SideBarRight from "../../components/SideBarRight";
import ZoneSwitcher from "../../components/ZoneSwitcher";

const BG_IMG = require("../../assets/images/backgrounds/bg_space_full.png");

export default function HomeScreen() {
  const onPressStub = (name) =>
    Alert.alert(name, "Şimdilik UI. Mekanikler burada.");

  const engine = useGameEngine();

  const anims = useStageAnims();

  return (
    <View style={styles.root}>
      <ImageBackground source={BG_IMG} style={styles.bg} resizeMode="cover">
        <MinersSheetHost
          // ✅ sadece bu değerler değişince sheet içeriği rebuild olur
          sheetContent={({ closeSheet }) => (
            <MinersSheet
              miners={minersDef}
              owned={engine.ownedMiners}
              ownedSkills={engine.ownedSkills}
              minerals={engine.minerals}
              getNextCost={(def, lvl) => getNextCost(def, lvl)}
              onBuyOrUpgrade={engine.buyOrUpgradeMiner}
              onBuySkill={engine.buySkill}
              onClose={closeSheet}
              unlockedCount={engine.unlockedCount}
            />
          )}
        >
          {({ toggleSheet, stageTranslateY, sheetProgress, Sheet }) => (
            <>
              <GameStage
                planetImg={engine.currentPlanetImg}
                stageTranslateY={stageTranslateY}
                sheetProgress={sheetProgress}
                puffScale={anims.puffScale}
                puffOpacity={anims.puffOpacity}
                planetSquash={anims.planetSquash}
                hover={anims.hover}
                minerIdle={anims.minerIdle}
                floaters={anims.floaters}
                isBossPlanet={engine.isBossPlanet}
                // ✅ Boss planet'te step yazma
                zoneText={
                  engine.isBossPlanet
                    ? `Zone ${engine.zone} • BOSS`
                    : `Zone ${engine.zone} • ${engine.step}/10`
                }
                hp={engine.hp}
                maxHp={engine.maxHp}
                // ✅ Timer: GameStage hangi ismi bekliyorsa yakalasın
                bossTimeMsLeft={engine.isBossPlanet ? engine.bossTimeMsLeft : 0}
                bossMsLeft={engine.isBossPlanet ? engine.bossTimeMsLeft : 0}
                bossTimerMs={engine.isBossPlanet ? engine.bossTimeMsLeft : 0}
                onTap={() => {
                  anims.runTapFeedback();
                  const { dmg, isCrit } = engine.calcTapDamage();
                  anims.addFloater(`${isCrit ? "CRIT " : ""}+${fmt(dmg)}`);
                  engine.applyDamage(dmg);
                }}
              />

              {/* ✅ Zone/Level geri */}
              <TopBar
                minerals={engine.minerals}
                fragments={engine.pendingFragments || 0}
                clickDamage={engine.calcTapDamage().dmg}
                dps={engine.totalDps}
                mode={engine.mode === "idle" ? "idle" : "click"}
                onToggleMode={engine.toggleMode}
              />
              <ZoneSwitcher
                zone={engine.zone}
                maxUnlockedZone={engine.maxUnlockedZone ?? engine.zone} // engine’de yoksa şimdilik zone
                onPrev={() => engine.goPrevZone?.()}
                onNext={() => engine.goNextZone?.()}
              />

              <SideBarRight
                mode={engine.mode} // "progress" | "farm"
                onToggleMode={engine.toggleMode}
                adReady={true} // şimdilik true, sonra Ads state’ine bağlarız
                onAdPress={() => onPressStub("GEM AD")}
              />
              {/* SOL BAR */}
              <SideBarLeft
                onSettings={() => console.log("Settings")}
                onAchievements={() => console.log("Achievements")}
                onRelics={() => console.log("Relics")}
                onClan={() => console.log("Clan")}
              />

              <BottomNav
                onMiners={toggleSheet} // Upgrades butonuna bastığında miners sheet açılıyor
                onPlanets={() => onPressStub("PLANETS")}
                onShop={() => onPressStub("SHOP")}
              />

              <Sheet />
            </>
          )}
        </MinersSheetHost>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1 },
});
