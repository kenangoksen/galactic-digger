// app/(tabs)/index.js
import { useState } from "react";
import { Alert, Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

import BottomNav from "../../components/BottomNav";
import SettingsSheetHost from "../../components/game/SettingsSheetHost";
import SkillsSheet from "../../components/game/SkillsSheet";
import MinersSheet from "../../components/MinersSheet";
import SettingsSheet from "../../components/SettingsSheet";
import TopBar from "../../components/TopBar";
import ActiveBuffTray from "../../components/ui/ActiveBuffTray"; // ✅ New (Retry)
import DevToolsModal from "../../components/ui/DevToolsModal";
import StatisticsModal from "../../components/ui/StatisticsModal"; // 📊
import TimeWarpResultModal from "../../components/ui/TimeWarpResultModal"; // ⏳
import WelcomeBackModal from "../../components/WelcomeBackModal";

import { fmt, getNextCost } from "../../game/damage";
import { useGameEngine } from "../../game/useGameEngine";
import { useStageAnims } from "../../game/useStageAnims";

import GameStage from "../../components/game/GameStage";
import MinersSheetHost from "../../components/game/MinersSheetHost";

import minersDef from "../../assets/config/miners.json";
import BigBangSheet from "../../components/BigBangSheet";
import CosmicStoreSheet from "../../components/CosmicStoreSheet";
import ShardShopSheet from "../../components/ShardShopSheet";
import SideBarLeft from "../../components/SideBarLeft";
import SideBarRight from "../../components/SideBarRight";
import BigBangModal from "../../components/ui/BigBangModal";
import StellarRewindModal from "../../components/ui/StellarRewindModal";
import ZoneSwitcher from "../../components/ZoneSwitcher";

const BG_IMG = require("../../assets/images/backgrounds/bg_space_full.png");

export default function HomeScreen() {
  const onPressStub = (name) =>
    Alert.alert(name, "Şimdilik UI. Mekanikler burada.");

  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  const engine = useGameEngine();

  const handleReset = () => {
    Alert.alert(
      "RESET GAME",
      "Are you sure? All progress, minerals, and miners will be lost forever.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "RESET",
          style: "destructive",
          onPress: () => {
            engine.resetGame();
            setShowSettings(false);
          },
        },
      ]
    );
  };

  const anims = useStageAnims();

  const [activeSheet, setActiveSheet] = useState(null); // null | "MINERS" | "COSMIC"
  const [visibleContent, setVisibleContent] = useState("MINERS"); // Persists during close animation

  // Exclusive Toggle Logic
  const toggleSheet = (name) => {
      // If opening a new sheet, update content immediately
      if (name && activeSheet !== name) {
          setVisibleContent(name);
      }
      
      setActiveSheet(prev => prev === name ? null : name);
  };

  // Helper to expand the sheet (assuming it's passed from MinersSheetHost)
  // This function needs to be provided by MinersSheetHost or derived from its state.
  // For now, we'll assume a placeholder `expandSheet` is available or will be passed.
  // In a real scenario, `expandSheet` would likely be `() => setActiveSheet(visibleContent)`
  // or a more sophisticated function from the sheet host.
  const expandSheet = useCallback(() => {
    setActiveSheet(visibleContent);
  }, [visibleContent]);


  const handleMiners = () => toggleSheet("MINERS");
  const handleCosmic = () => toggleSheet("COSMIC");

  const handleSkills = () => toggleSheet("SKILLS");
  const handleBigBang = useCallback(() => {
      setVisibleContent("BIGBANG");
      expandSheet();
  }, [expandSheet]);

  const handleShop = useCallback(() => {
    setVisibleContent("SHOP");
    expandSheet();
  }, [expandSheet]);

  // DevTools Mock Helper

  return (
    <>
    <View style={styles.root}>
      <ImageBackground source={BG_IMG} style={styles.bg} resizeMode="cover">
        <MinersSheetHost
          visible={activeSheet !== null}
          onClose={() => setActiveSheet(null)}
          sheetContent={({ closeSheet }) => {
            if (visibleContent === "SHOP") {
                return (
                    <ShardShopSheet
                  visible={true}
                  onClose={closeSheet}
                  shards={engine.eco.shards} // ✅ Pass Shards
                  droneCount={engine.droneCount}
                  buyShopItem={engine.buyShopItem}
                  watchAdForShards={console.log}
                  totalDps={engine.totalDps}
                  zone={engine.zone} // ✅ Pass Zone
                  step={engine.step} // ✅ Pass Step
              />
                );
            }

            if (visibleContent === "COSMIC") {
                return (
                  <CosmicStoreSheet
                    visible={true} 
                    stellarFragments={engine.stellarFragments}
                    cosmicProtocols={engine.cosmicProtocols}
                    onBuy={engine.upgradeProtocol} // ✅ Use proper upgrade method
                    onClose={closeSheet} 
                    
                    // Summoning Props (Single Source of Truth)
                    summonPool={engine.summonPool}
                    rerollCount={engine.rerollCount}
                    unlockProtocol={engine.unlockProtocol}
                    rerollSlot={engine.rerollSlot}
                    generateSummonPool={engine.generateSummonPool}
                    getNextUnlockCost={engine.getNextUnlockCost}
                  />
                );
            }
            if (visibleContent === "SKILLS") {
                return (
                    <SkillsSheet 
                        engine={engine}
                        onClose={closeSheet}
                    />
                );
            }
            if (visibleContent === "BIGBANG") { // ✅ Render Sheet
                return (
                    <BigBangSheet
                        visible={true}
                        onClose={closeSheet}
                        cosmicEssence={engine.cosmicEssence}
                        universalConstantsLevels={engine.universalConstantsLevels}
                        buyUniversalConstant={engine.buyUniversalConstant}
                        performBigBang={engine.performBigBang}
                        stats={engine.stats}
                        maxUnlockedZone={engine.maxUnlockedZone}
                        onOpenModal={() => engine.setShowBigBangModal(true)}
                    />
                );
            }
            // Default to MINERS
            return (
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
                  tagsByMinerId={engine.eco.tagsByMinerId} // ✅ Pass Tags
                />
            );
          }}
        >
          {({ stageTranslateY, stageScale, sheetProgress, Sheet }) => (
            <>
              {/* --- GLOBAL TOASTS --- */}
              {engine.tagToast && (
                <View style={styles.toastContainer} pointerEvents="none">
                    <View style={styles.toastBox}>
                        <View style={styles.toastContent}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                <MaterialCommunityIcons name="star-four-points" size={20} color="#ffd700" />
                                <Text style={{color: '#ffd700', fontWeight: 'bold', fontSize: 16}}>
                                    {engine.tagToast.message}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
              )}

              <GameStage
                planetImg={engine.currentPlanetImg}
                stageTranslateY={stageTranslateY}
                stageScale={stageScale}
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
                    ? `Zone ${isNaN(engine.zone) ? 1 : engine.zone} • BOSS`
                    : `Zone ${isNaN(engine.zone) ? 1 : engine.zone} • ${engine.step}/10`
                }
                hp={engine.hp}
                maxHp={engine.maxHp}
                // ✅ Timer: GameStage hangi ismi bekliyorsa yakalasın
                bossTimeMsLeft={engine.isBossPlanet ? engine.bossTimeMsLeft : 0}
                bossMsLeft={engine.isBossPlanet ? engine.bossTimeMsLeft : 0}
                bossTimerMs={engine.isBossPlanet ? engine.bossTimeMsLeft : 0}
                isPrimal={engine.isPrimal} // 🟣
                onTap={() => {
                  anims.runTapFeedback();
                  const { dmg, isCrit } = engine.handleTap(); // ✅ Use new handler
                  anims.addFloater(`${isCrit ? "CRIT " : ""}+${fmt(dmg)}`);
                }}
                activeDroneCount={engine.activeDroneCount}
              />

              <TopBar
                minerals={engine.minerals}
                fragments={engine.stellarFragments || 0}
                clickDamage={engine.calcTapDamage().dmg}
                dps={engine.totalDps}
                prestigeReward={engine.prestigeReward}
                streak={engine.uiStreak}
                isIdle={engine.isIdle} 
                hasIdleBonus={engine.hasIdleBonus} // ✅ Check eligibility
              />
              <ZoneSwitcher
                zone={engine.zone}
                maxUnlockedZone={engine.maxUnlockedZone ?? engine.zone}
                onPrev={() => engine.goPrevZone?.()}
                onNext={() => engine.goNextZone?.()}
                comboActive={engine.uiStreak > 5} // Push down if combo visible
              />

              {/* DRONE CONTROL */}
              {engine.droneCount > 0 && (
                  <Pressable 
                    onPress={engine.toggleDrone}
                    style={styles.droneCtrl}
                  >
                      <Image 
                        source={require("../../assets/images/sprites/drones/drone_01.png")}
                        style={styles.droneIcon}
                      />
                      <View style={styles.droneBadge}>
                          <Text style={styles.droneText}>
                              {engine.droneCount - engine.activeDroneCount}/{engine.droneCount}
                          </Text>
                      </View>
                  </Pressable>
              )}
              
              <ActiveBuffTray cosmicProtocols={engine.cosmicProtocols} />

              <SideBarRight
                mode={engine.mode} // "progress" | "farm"
                onToggleMode={engine.toggleMode}
                adReady={true} // şimdilik true, sonra Ads state’ine bağlarız
                onAdPress={handleShop} // ✅ Link to Shard Shop
                onDevTools={() => {
                    console.log("Setting showDevTools to TRUE");
                    setShowDevTools(true);
                }}
              />
              {/* SOL BAR */}
              <SideBarLeft
                onSettings={() => setShowSettings(true)}
                onAchievements={() => console.log("Achievements")}
                onRelics={() => console.log("Relics")}
                onClan={() => console.log("Clan")}
              />

              <BottomNav
                onMiners={handleMiners}
                onPlanets={() => onPressStub("PLANETS")}
                onSkills={handleSkills} // ✅ Connected
                onGem={handleShop} // ✅ Link to Shop
                onQuests={() => onPressStub("QUESTS")}
                onProtocols={handleCosmic}
                onBigBang={handleBigBang} // ✅ Connect
                onShop={handleShop} // ✅ Link to Shop
              />
              
              <Sheet />

              {/* Settings Overlay - Sibling, not Wrapper */}
              <SettingsSheetHost
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                sheetContent={
                  <SettingsSheet
                    onClose={() => setShowSettings(false)}
                    onReset={handleReset}
                    onStats={() => {
                        setShowSettings(false);
                        setShowStats(true);
                    }}
                  />
                }
              />

              {/* Statistics Modal 📊 - Fullscreen over everything */}
              <StatisticsModal
                  visible={showStats}
                  stats={engine.stats}
                  eco={engine.eco} // ✅ Pass Eco for Milestones
                  onClose={() => setShowStats(false)}
              />

              {/* Offline Earnings Modal */}
              <WelcomeBackModal
                visible={!!engine.offlineEarnings}
                earnings={engine.offlineEarnings?.amount || 0}
                seconds={engine.offlineEarnings?.seconds || 0}
                onCollect={engine.collectOfflineEarnings}
              />
              
              {/* Prestige Modal */}
              <StellarRewindModal
                visible={engine.showRewindModal}
                rewardAmount={engine.prestigeReward || 0}
                currentZone={engine.maxUnlockedZone}
                onClose={() => engine.setShowRewindModal(false)}
                onConfirm={engine.confirmStellarRewind}
              />

              {/* Big Bang Modal */}
              <BigBangModal 
                  visible={engine.showBigBangModal}
                  onClose={() => engine.setShowBigBangModal(false)}
                  onConfirm={engine.performBigBang}
                  gainedEssence={engine.calcBigBangGain?.().gain || 0}
                  highestZone={engine.calcBigBangGain?.().highestZone || 0}
              />
            </>
          )}
        </MinersSheetHost>
      </ImageBackground>
    </View>

    <TimeWarpResultModal 
      visible={!!engine.timeWarpResult} 
      result={engine.timeWarpResult} 
      onClose={engine.clearTimeWarpResult}
    />

    <DevToolsModal 
      visible={showDevTools} 
      onClose={() => setShowDevTools(false)} 
      engine={engine} 
    />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1 },
  droneCtrl: {
      position: 'absolute',
      left: 16,
      top: 120, // Top Left, below TopBar
      width: 50,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 40,
  },
  droneIcon: {
      width: 48,
      height: 48,
  },
  droneBadge: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      backgroundColor: '#10b981',
      borderRadius: 10,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: '#064e3b',
  },
  droneText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: 'bold',
  },
});
