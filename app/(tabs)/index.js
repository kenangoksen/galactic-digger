// app/(tabs)/index.js
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

import BottomNav from "../../components/BottomNav";
import SettingsSheetHost from "../../components/game/SettingsSheetHost";
import SkillsSheet from "../../components/game/SkillsSheet";
import MinersSheet from "../../components/MinersSheet";
import SettingsSheet from "../../components/SettingsSheet";
import TopBar from "../../components/TopBar";
import AchievementsModal from "../../components/ui/AchievementsModal"; // 🏆 New
import ActiveBuffTray from "../../components/ui/ActiveBuffTray"; // ✅ New (Retry)
import DevToolsModal from "../../components/ui/DevToolsModal";
import QuestSelectionModal from "../../components/ui/QuestSelectionModal"; // 🚀
import StatisticsModal from "../../components/ui/StatisticsModal"; // 📊
import TimeWarpResultModal from "../../components/ui/TimeWarpResultModal"; // ⏳
import WelcomeBackModal from "../../components/WelcomeBackModal";

import { fmt, getNextCost } from "../../game/damage";
import { useGameEngine } from "../../game/useGameEngine";
import { useStageAnims } from "../../game/useStageAnims";

import GameStage from "../../components/game/GameStage";
import MinersSheetHost from "../../components/game/MinersSheetHost";

import achievementsDef from "../../assets/config/achievements.json"; // 🏆
import minersDef from "../../assets/config/miners.json";
import ArtifactsSheet from "../../components/ArtifactsSheet"; // 🏆
import BigBangSheet from "../../components/BigBangSheet";
import CosmicStoreSheet from "../../components/CosmicStoreSheet";
import ExplorersSheet from "../../components/ExplorersSheet"; // 🚀
import ShardShopSheet from "../../components/ShardShopSheet";
import SideBarLeft from "../../components/SideBarLeft";
import SideBarRight from "../../components/SideBarRight";
import BigBangModal from "../../components/ui/BigBangModal";
import StellarRewindModal from "../../components/ui/StellarRewindModal";
import ZoneSwitcher from "../../components/ZoneSwitcher";
import { D } from "../../game/bn";

const BG_IMG = require("../../assets/images/backgrounds/bg_space_full.png");

export default function HomeScreen() {
  const onPressStub = (name) =>
    Alert.alert(name, "Şimdilik UI. Mekanikler burada.");

  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false); // 🏆
  const [showArtifacts, setShowArtifacts] = useState(false); 
  const [showExplorers, setShowExplorers] = useState(false); 
  const [showDevTools, setShowDevTools] = useState(false);
  const [selectedExplorer, setSelectedExplorer] = useState(null); // For quest selection
  const [questOptions, setQuestOptions] = useState([]); // 4 quest options

  const engine = useGameEngine();

  // 🔄 Refresh Badge Interval
  const [tick, setTick] = useState(0);
  useEffect(() => {
      const interval = setInterval(() => setTick(t => t + 1), 2000); // 2s refresh for badge
      return () => clearInterval(interval);
  }, []);

  // 🏆 Calculate Unclaimed Achievements (FRESH on every tick)
  const freshStats = engine.getStats ? engine.getStats() : (engine.stats || {});
  const claimedAchList = engine.claimedAchievements || [];
  
  // Force tick to be consumed so React keeps re-rendering
  void tick;
  
  const unclaimedCount = achievementsDef.filter(ach => {
      // Check if already claimed
      if (claimedAchList.includes(ach.id)) return false;

      // Check if completed
      const keys = ach.statKey.split(".");
      let val = freshStats;
      for (const k of keys) {
          val = val?.[k];
      }
       
      // Safe number conversion
      let numVal = 0;
      if (typeof val === 'string') {
           numVal = D(val).toNumber();
      } else {
           numVal = Number(val || 0);
      }

      return numVal >= ach.threshold;
  }).length;

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



  const handleMiners = () => {
    toggleSheet("MINERS");
    setShowExplorers(false); // Close Explorers
    setShowArtifacts(false); // Close Artifacts
  };
  
  const handleCosmic = () => {
    toggleSheet("COSMIC");
    setShowExplorers(false); // Close Explorers
    setShowArtifacts(false); // Close Artifacts
  };
  
  const handleArtifacts = useCallback(() => {
     setShowArtifacts(true);
     setActiveSheet(null); // Close others
     setShowExplorers(false); // Close Explorers
  }, []);

  const handleExplorers = useCallback(() => {
     toggleSheet("EXPLORERS");
     setShowArtifacts(false); // Close Artifacts (still needed as it's a separate modal)
     // toggleSheet already handles closing other sheets in MinersSheetHost
  }, [toggleSheet]);

  const handleSkills = () => {
    toggleSheet("SKILLS");
    setShowExplorers(false); // Close Explorers
    setShowArtifacts(false); // Close Artifacts
  };
  
  const handleBigBang = useCallback(() => {
      setVisibleContent("BIGBANG");
      expandSheet();
      setShowExplorers(false); // Close Explorers
      setShowArtifacts(false); // Close Artifacts
  }, [expandSheet]);

  const handleShop = useCallback(() => {
    setVisibleContent("SHOP");
    expandSheet();
    setShowExplorers(false); // Close Explorers
    setShowArtifacts(false); // Close Artifacts
  }, [expandSheet]);

  // DevTools Mock Helper

  // Offline Earnings Handler
  const handleOfflineCollect = useCallback((multiplier) => {
      if (multiplier === "SHOP_REQUEST") {
          Alert.alert(
              "Yetersiz Shard", 
              "Maalesef yeterli Shard yok. Mağazaya gitmek ister misin?",
              [
                  { text: "Hayır", style: "cancel" },
                  { 
                      text: "Evet", 
                      onPress: () => {
                          engine.collectOfflineEarnings(1); // Collect free first? Or keep pending?
                          // Usually we just open shop and let modal stay?
                          // If modal stays, user can buy then click 3x again.
                          // But `WelcomeBackModal` covers screen.
                          // Let's close modal (collect x1) OR keep it?
                          // User said: "Mağaza açılsın".
                          // If we open shop sheet, it might be behind modal if modal is topmost?
                          // WelcomeBackModal is Modal component (z-index high).
                          // We might need to close WelcomeBackModal temporarily?
                          // Or better: Just navigate to shop and let user handle it?
                          // Given modal is `Modal`, we can't show sheet over it easily without closing it.
                          // Let's just Open Shop and Close Modal (collecting 1x as penalty/default? or 0x wait?)
                          // "Satın almak ister misiniz" -> If yes, we should let them buy.
                          // If they buy, they need to come back.
                          // Complex flow.
                          // For now: Close modal (claim 1x) -> Open Shop.
                          // "Mağazaya gitmek ister misin?" implied leaving this screen.
                          
                          // BETTER UX: Just open Shop Sheet. 
                          // If `WelcomeBackModal` is a React Native `Modal`, it covers everything.
                          // We can't show BottomSheet over RN Modal.
                          // So we MUST close standard Modal.
                          // To keep earnings, we must NOT collect.
                          // But `offlineEarnings` state controls visibility.
                          // We need a way to "Hide" modal but keep state?
                          // Too complex for now.
                          // Let's just Collect 1x and Open Shop.
                          engine.collectOfflineEarnings(1); 
                          handleShop();
                      }
                  }
              ]
          );
          return;
      }
      
      engine.collectOfflineEarnings(multiplier);
  }, [engine, handleShop]);

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
                  watchAdForShards={engine.watchAdForShards} // ✅ Fix prop
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
            if (visibleContent === "ARTIFACTS") {
                // Now handled as standalone modal
                return null;
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
            if (visibleContent === "EXPLORERS") {
                return (
                    <ExplorersSheet
                        visible={true} // Controlled by Host
                        onClose={closeSheet}
                        explorers={engine.eco?.explorers}
                        onStartQuest={(explorerId) => {
                            const explorer = engine.eco?.explorers?.byId[explorerId];
                            if (explorer) {
                                // Use existing quests if available, otherwise generate new ones
                                if (explorer.availableQuests && explorer.availableQuests.length > 0) {
                                    setQuestOptions(explorer.availableQuests);
                                    setSelectedExplorer(explorer);
                                } else {
                                    // Generate quests for first time
                                    const { generateQuests } = require("../../game/explorers/explorerService");
                                    const quests = generateQuests(explorer, engine.zone || 1);
                                    
                                    // Save quests to explorer
                                    engine.dispatchEco({ 
                                        type: "GENERATE_QUESTS", 
                                        explorerId, 
                                        quests 
                                    });
                                    
                                    setQuestOptions(quests);
                                    setSelectedExplorer(explorer);
                                }
                            }
                        }}
                        onPurchase={() => {
                            const cost = 40;
                            if (engine.eco.shards >= cost) {
                                Alert.alert(
                                    "Recruit Explorer",
                                    `Recruit a new Explorer for ${cost} Shards?`,
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { 
                                            text: "Recruit", 
                                            onPress: () => {
                                                engine.dispatchEco({ type: "SPEND_SHARDS", amount: cost });
                                                engine.dispatchEco({ type: "GRANT_EXPLORER" });
                                            }
                                        }
                                    ]
                                );
                            } else {
                                Alert.alert("Insufficient Shards", `You need ${cost} Shards to recruit an Explorer.`);
                            }
                        }}
                        currentShards={engine.eco.shards}
                        onDismiss={(explorer) => {
                            Alert.alert(
                                "Dismiss Explorer",
                                `Are you sure you want to dismiss ${explorer.name}? They will be lost forever.`,
                                [
                                    { text: "Cancel", style: "cancel" },
                                    { 
                                        text: "Dismiss", 
                                        style: "destructive",
                                        onPress: () => {
                                            engine.dispatchEco({ type: "DISMISS_EXPLORER", explorerId: explorer.id });
                                            // Close quest selection if open for this explorer (cleanup)
                                            if (selectedExplorer?.id === explorer.id) {
                                                setSelectedExplorer(null);
                                                setQuestOptions([]);
                                            }
                                        }
                                    }
                                ]
                            );
                        }}
                        onCollect={(explorer) => {
                            engine.dispatchEco({ type: "COLLECT_QUEST", explorerId: explorer.id });
                            // Optional: Show a quick feedback if desired, or let the UI update naturally
                             // We could add a toast here if we had a toast system ready
                        }}
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
                
                // Clickables
                activeClickable={engine.activeClickable}
                onClickablePress={(item) => {
                    const res = engine.handleClickable(item);
                    if (res) {
                        // Calculate position relative to center (approx stage size)
                        // item.x/y are 0..1. Center is 0.5
                        const x = (item.x - 0.5) * 320; 
                        const y = (item.y - 0.5) * 500;

                        if (res.type === "MINERALS") {
                            anims.addFloater(`+${fmt(res.amount)} Mineral`, {
                                x, y,
                                duration: 2000,
                                color: "#ef4444", 
                                fontSize: 22,
                            });
                        } else if (res.type === "SHARDS") { 
                             anims.addFloater(`+${res.amount} Shard!`, {
                                 x, y,
                                 duration: 2500,
                                 color: "#fbbf24", 
                                 fontSize: 24,
                             });
                        }
                    }
                }}
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
                onAchievements={() => setShowAchievements(true)} 
                notificationCount={unclaimedCount} // 🔔 Badge
                onArtifacts={handleArtifacts} 
                onClan={() => console.log("Clan")}
              />

              <BottomNav
                onMiners={handleMiners}
                onPlanets={() => onPressStub("PLANETS")}
                onSkills={handleSkills} // ✅ Connected
                onGem={handleShop} // ✅ Link to Shop
                onQuests={handleExplorers} // 🚀 Explorers
                onProtocols={handleCosmic}
                onBigBang={handleBigBang} // ✅ Connect
                onShop={handleShop} // ✅ Link to Shop
              />
              
            <Sheet /> 
            
            {/* 🏆 ARTIFACTS MODAL - Full View except TopBar */}
            {showArtifacts && (
                 <ArtifactsSheet
                      visible={true}
                      onClose={() => setShowArtifacts(false)}
                      artifacts={engine.eco?.artifacts}
                      onEquip={(id) => engine.dispatchEco({ type: "EQUIP_ARTIFACT", id })}
                      onUnequip={(id) => engine.dispatchEco({ type: "UNEQUIP_ARTIFACT", id })}
                      onUpgrade={(id) => engine.dispatchEco({ type: "UPGRADE_ARTIFACT", id })}
                      onSalvage={(id) => engine.dispatchEco({ type: "SALVAGE_ARTIFACT", id })}
                    />
            )}


            {/* 🎯 QUEST SELECTION MODAL */}
            {selectedExplorer && questOptions.length > 0 && (
                <QuestSelectionModal
                    visible={true}
                    onClose={() => {
                        setSelectedExplorer(null);
                        setQuestOptions([]);
                    }}
                    explorer={selectedExplorer}
                    quests={questOptions}
                    onSelectQuest={(quest) => {
                        // Dispatch START_QUEST action
                        engine.dispatchEco({ 
                            type: "START_QUEST", 
                            explorerId: selectedExplorer.id, 
                            quest 
                        });
                        setSelectedExplorer(null);
                        setQuestOptions([]);
                    }}
                    onRerollQuests={() => {
                        // Reroll quests (costs 10 shards)
                        const { generateQuests } = require("../../game/explorers/explorerService");
                        const newQuests = generateQuests(selectedExplorer, engine.zone || 1);
                        setQuestOptions(newQuests);
                        // TODO: Deduct shards
                        engine.dispatchEco({ type: "SPEND_SHARDS", amount: 10 });
                    }}
                    currentShards={engine.eco?.shards || 0}
                />
            )}

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
                avgDps={engine.offlineEarnings?.avgDps} // ✅ Pass
                zonesGained={engine.offlineEarnings?.zonesGained} // ✅ Pass
                shards={engine.eco.shards} // 💎 Pass Shards
                onCollect={handleOfflineCollect} // ✅ Use Handler
                onClose={() => engine.collectOfflineEarnings(1)} // Fallback close
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

      <AchievementsModal
        visible={showAchievements}
        onClose={() => setShowAchievements(false)}
        engine={engine} // ✅ Pass shared engine instance
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
