// components/syndicate/SyndicateSheet.js
// Main Federation (Clan) panel — FULL SCREEN MODAL
// Enforces "Create Nickname" before joining/creating a clan.


import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { getDailyWeakness, WEAKNESSES } from "../../game/syndicate/raidService";
import NiceModal from "../ui/NiceModal";
import TitanRaidModal from "./TitanRaidModal";


const SPECIALTIES = [
  { id: "striker",    label: "Striker",    icon: "flash",      color: "#ef4444", desc: "Tap Damage +5%/lvl", weakness: "physical" },
  { id: "technician", label: "Technician", icon: "construct",  color: "#3b82f6", desc: "Miner DPS +5%/lvl",   weakness: "energy" },
  { id: "guardian",   label: "Guardian",   icon: "shield",     color: "#22c55e", desc: "Raid Time +5s",       weakness: "shield" },
];

const WEAKNESS_LABELS = {
  physical: { label: "Physical", icon: "flash", color: "#ef4444" },
  energy:   { label: "Energy",   icon: "flame", color: "#f97316" },
  shield:   { label: "Shield",   icon: "prism", color: "#8b5cf6" },
};

export default function SyndicateSheet({ visible, onClose, syndicateHook, onAddShards, shards = 0, onSpendShards }) {
  const syn = syndicateHook;

  // ─── HOOKS (Must be at top) ───
  const [tab, setTab] = useState("overview"); // overview | members | specialty
  const [showRaid, setShowRaid] = useState(false);

  // Custom Alert Modal
  const [modal, setModal] = useState({ 
      visible: false, 
      title: "", 
      message: "", 
      type: "info",
      onConfirm: null,
      confirmText: "Confirm",
      cancelText: "Cancel"
  });
  
  const showModal = (title, message, type = "info", onConfirm = null, confirmText = "OK", cancelText = "Cancel") => {
      setModal({ visible: true, title, message, type, onConfirm, confirmText, cancelText });
  };
  
  // Forms
  const [joinCode, setJoinCode] = useState("");
  const [federationName, setFederationName] = useState("");
  const [agentName, setAgentName] = useState("");
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // ─── Raid Timer ───
  useEffect(() => {
    const updateTimer = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCHours(24, 0, 0, 0); // Next UTC Midnight
        const diff = tomorrow - now;
        
        if (diff <= 0) {
           setTimeLeft("00:00:00");
        } else {
           const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
           const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
           const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
           setTimeLeft(`${h}:${m}:${s}`);
        }
    };
    
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Conditional Return AFTER Hooks ───
  if (!visible) return null;

  // ─── Profile Check ───
  const hasDefaultName = syn.userProfile?.displayName?.startsWith("Digger_");
  const needsProfile = !syn.userProfile?.displayName || hasDefaultName;

  // ─── Actions ───

  const handleCreateProfile = async () => {
    if (!agentName.trim()) {
      Alert.alert("Invalid Name", "Please enter a valid nickname.");
      return;
    }
    if (agentName.trim().length < 3) {
      Alert.alert("Name too short", "Nickname must be at least 3 characters.");
      return;
    }
    setBusy(true);
    try {
      await syn.updateName(agentName.trim());
      Alert.alert("Success", "Nickname initialized! Welcome to the network.");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
    setBusy(false);
  };

  const handleCreateFederation = async () => {
    if (!federationName.trim()) return;

    const COST = 500;
    if (shards < COST) {
        showModal("Insufficient Shards", `You need ${COST} Shards to establish a Federation.`, "error");
        return;
    }

    showModal(
        "Establish Federation",
        `Create "${federationName}" for ${COST} Shards?`,
        "question",
        async () => {
             setModal(prev => ({ ...prev, visible: false }));
             setBusy(true); // show spinner?
             // Actually NiceModal might close, so we might need a local spinner or just blocking interaction
             // For now, let's proceed
             
             try {
                if (onSpendShards) onSpendShards(COST);
                await syn.createSyndicate(federationName.trim()); 
                setShowCreateForm(false);
                setFederationName("");
                setTimeout(() => {
                    showModal("Success", "Federation established! You are now the leader.", "success");
                }, 500);
             } catch (e) {
                // Refund?
                // if (onAddShards) onAddShards(COST);
                setTimeout(() => {
                    showModal("Error", e.message, "error");
                }, 500);
             }
             setBusy(false);
        },
        "Create",
        "Cancel"
    );
  };

  const handleSearch = async () => {
     if (!joinCode.trim()) return;
     setSearching(true);
     try {
       // Search either by name match or exact Invite Code
       const results = await syn.searchSyndicates(joinCode.trim());
       setSearchResults(results);
       if (results.length === 0) {
           showModal("No Results", "No federations found matching that name or code.", "error");
       }
     } catch(e) {
       showModal("Search Error", e.message, "error");
     }
     setSearching(false);
    };

  const handleJoinFederation = async (inviteCode) => {
    setBusy(true);
    try {
      await syn.joinSyndicate(inviteCode);
      setShowJoinForm(false);
      setJoinCode("");
      setSearchResults([]);
      showModal("Success", "Connection established. Welcome to the Federation.", "success");
    } catch (e) {
      showModal("Federation not found", e.message, "error");
    }
    setBusy(false);
  };
  
  // Legacy "Join by Code" direct handler if they have the exact code
  const handleDirectJoin = async () => {
      if (!joinCode.trim()) return;
      handleJoinFederation(joinCode.trim());
  };

  const handleLeave = () => {
    showModal(
      "Leave Federation?",
      "Are you sure you want to leave? You'll lose access to raid rewards.",
      "question",
      async () => {
        setModal(prev => ({ ...prev, visible: false }));
        try { 
            await syn.leaveSyndicate(); 
            // Small delay to allow modal close animation
            setTimeout(() => {
                showModal("Left Federation", "You have successfully left the federation.", "success");
            }, 300);
        } catch (e) { 
            setTimeout(() => {
                showModal("Error", e.message, "error"); 
            }, 300);
        }
      },
      "Leave",
      "Cancel"
    );
  };

  const handleClaimReward = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const rewards = await syn.claimReward();
      // rewards.shards is now returned instead of rubies
      if (onAddShards && rewards.shards) onAddShards(rewards.shards);
      showModal(
        "🎉 Rewards Claimed!",
        `+${rewards.titanFragments} Titan Fragments\n+${rewards.shards} Shards`,
        "success"
      );
    } catch (e) {
      showModal("Claim Failed", e.message, "error");
    }
    setBusy(false);
  };

  // ─── Loading View ───
  if (syn.loading) {
    return (
      <Modal visible animationType="slide" transparent={false}>
        <View style={s.fullContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={s.loadingText}>Accessing Galaxy Network…</Text>
        </View>
      </Modal>
    );
  }

  // ─── Error View ───
  if (syn.error) {
     return (
      <Modal visible animationType="slide" transparent={false}>
        <View style={s.fullContainer}>
          <View style={s.centerBox}>
            <Ionicons name="alert-circle" size={64} color="#ef4444" />
            <Text style={[s.heroTitle, { color: "#ef4444" }]}>Connection Error</Text>
            <Text style={s.heroSub}>{syn.error}</Text>
            <Pressable style={s.primaryBtn} onPress={syn.refresh}>
              <Text style={s.primaryBtnText}>Retry Connection</Text>
            </Pressable>
            <Pressable style={s.closeBtnAbsolute} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ─── 1. Mandatory Profile Creation View ───
  if (needsProfile) {
    return (
      <Modal visible animationType="slide" transparent={false}>
        <View style={s.fullContainer}>
          <View style={s.centerBox}>
            <Ionicons name="person-circle" size={80} color="#a855f7" />
            <Text style={s.heroTitle}>Create Your Nickname</Text>
            <Text style={s.heroSub}>
              Establish your unique identity in the galaxy.
            </Text>

            <View style={s.formBox}>
              <Text style={s.inputLabel}>NICKNAME</Text>
              <TextInput
                style={s.inputBig}
                placeholder="Nickname..."
                placeholderTextColor="#666"
                value={agentName}
                onChangeText={setAgentName}
                maxLength={12}
                autoCapitalize="words"
              />
              <Pressable style={s.primaryBtn} onPress={handleCreateProfile} disabled={busy}>
                <Text style={s.primaryBtnText}>{busy ? "Creating..." : "Create Nickname"}</Text>
                {!busy && <Ionicons name="arrow-forward" size={20} color="#fff" />}
              </Pressable>
            </View>

            <Pressable style={s.closeBtnAbsolute} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ─── 2. Not In Federation: Create / Join ───
  if (!syn.isInSyndicate) {
    return (
      <Modal visible animationType="slide" transparent={false}>
        <View style={s.fullContainer}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Federation Network</Text>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={[s.centerBox, (showCreateForm || showJoinForm) && { justifyContent: 'flex-start', paddingTop: 40 }]}>
            {!showCreateForm && !showJoinForm && (
              <>
                <Ionicons name="planet" size={100} color="rgba(168,85,247,0.5)" />
                <Text style={s.heroTitle}>Join the Fight</Text>
                <Text style={s.heroSub}>
                  Band together with other miners. Defeat Void Titans. Earn massive rewards.
                </Text>

                <Pressable style={s.bigOptionBtn} onPress={() => setShowCreateForm(true)}>
                  <View style={s.iconCircle}>
                    <Ionicons name="add" size={24} color="#fff" />
                  </View>
                  <View>
                    <Text style={s.optionTitle}>Create Federation</Text>
                    <Text style={s.optionSub}>Start your own clan (Cost: 500 Shards)</Text>
                  </View>
                </Pressable>

                <Pressable style={[s.bigOptionBtn, { borderColor: "rgba(59,130,246,0.5)" }]} onPress={() => setShowJoinForm(true)}>
                  <View style={[s.iconCircle, { backgroundColor: "#1e3a5f" }]}>
                    <Ionicons name="enter" size={24} color="#fff" />
                  </View>
                  <View>
                    <Text style={s.optionTitle}>Join Federation</Text>
                    <Text style={s.optionSub}>Enter an invite code</Text>
                  </View>
                </Pressable>
              </>
            )}

            {/* Create Form */}
            {showCreateForm && (
              <View style={s.formBox}>
                <Text style={s.formTitle}>Initialize Federation</Text>
                <TextInput
                  style={s.input}
                  placeholder="Federation Name"
                  placeholderTextColor="#666"
                  value={federationName}
                  onChangeText={setFederationName}
                  maxLength={20}
                />
                <View style={s.btnRow}>
                  <Pressable style={s.secondaryBtn} onPress={() => setShowCreateForm(false)}>
                    <Text style={s.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={s.primaryBtnSmall} onPress={handleCreateFederation} disabled={busy}>
                    <Text style={s.primaryBtnText}>{busy ? "..." : "Create (500 Shards)"}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Join Form / Search */}
            {showJoinForm && (
              <View style={[s.formBox, { maxHeight: 500 }]}>
                <Text style={s.formTitle}>Federation Search</Text>
                
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Name or Invite Code"
                      placeholderTextColor="#666"
                      value={joinCode}
                      onChangeText={setJoinCode}
                    />
                    <Pressable style={s.primaryBtnSmall} onPress={handleSearch} disabled={searching}>
                         {searching ? <ActivityIndicator color="#fff"/> : <Ionicons name="search" size={20} color="#fff" />}
                    </Pressable>
                </View>

                {searchResults.length > 0 && (
                    <ScrollView style={{ maxHeight: 200, marginTop: 10 }} nestedScrollEnabled>
                        {searchResults.map(f => (
                            <View key={f.id} style={s.searchResultRow}>
                                <View>
                                    <Text style={s.resultName}>{f.name}</Text>
                                    <Text style={s.resultSub}>{f.memberCount}/10 • Lvl {f.titanLevel}</Text>
                                </View>
                                <Pressable 
                                    style={s.joinBtnSmall} 
                                    onPress={() => handleJoinFederation(f.inviteCode)}
                                    disabled={busy}
                                >
                                    <Text style={s.joinBtnText}>JOIN</Text>
                                </Pressable>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <View style={[s.btnRow, { marginTop: 16 }]}>
                  <Pressable style={s.secondaryBtn} onPress={() => {
                        setShowJoinForm(false);
                        setSearchResults([]);
                        setJoinCode("");
                  }}>
                    <Text style={s.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                   {/* Fallback to direct join if user typed a specific code but didn't search */}
                   { joinCode.length === 6 && searchResults.length === 0 && (
                       <Pressable style={s.primaryBtnSmall} onPress={handleDirectJoin} disabled={busy}>
                         <Text style={s.primaryBtnText}>Join by Code</Text>
                       </Pressable>
                   )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Global Modal for Alerts */}
        <NiceModal 
            visible={modal.visible}
            title={modal.title}
            message={modal.message}
            type={modal.type}
            onConfirm={modal.onConfirm}
            confirmText={modal.confirmText}
            cancelText={modal.cancelText}
            onClose={() => setModal(prev => ({ ...prev, visible: false }))}
        />
      </Modal>
    );
  }

  // ─── 3. In Federation: Main View ───
  const raid = syn.todaysRaid;
  const canClaim = raid?.defeated && !raid?.rewardsClaimed?.includes(syn.userId);
  const hpPct = raid ? Math.min(1, raid.totalDamage / raid.titanHp) : 0;
  const todayWeakness = getDailyWeakness();
  const fed = syn.federation || {};

  return (
    <Modal visible animationType="slide" transparent={false}>
      <View style={s.fullContainer}>
        {/* Header */}
        <View style={s.appBar}>
          <Pressable onPress={onClose} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.appBarTitle}>{fed.name || "Federation"}</Text>
            <Text style={s.appBarSub}>
              {syn.members.length}/10 Members • Lvl {fed.titanLevel || 1}
            </Text>
            <Text style={{color:'#a855f7', fontSize:10, marginTop:2}}>
                 Agent: {syn.userProfile?.displayName}
            </Text>
          </View>
          <View style={{ width: 40 }} /> 
        </View>

        {/* Tab Bar */}
        <View style={s.tabBar}>
          {[
            { key: "overview", label: "Raid", icon: "skull" },
            { key: "members", label: "Agents", icon: "people" },
            { key: "specialty", label: "Specialty", icon: "school" },
          ].map((t) => (
            <Pressable
              key={t.key}
              style={[s.tab, tab === t.key && s.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={16} color={tab === t.key ? "#a855f7" : "#888"} />
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          
          {/* Invite Box (Tap to Copy) */}
          <Pressable 
            style={s.inviteCard}
            onPress={async () => {
                await Clipboard.setStringAsync(fed.inviteCode);
                // Use NiceModal (showModal) instead of native Alert
                showModal("Copied!", `Federation Code ${fed.inviteCode} copied to clipboard.`, "success");
            }}
          >
            <Text style={s.inviteLabel}>FEDERATION CODE (TAP TO COPY)</Text>
            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8}}>
                <Text style={s.inviteCode}>{fed.inviteCode}</Text>
                <Ionicons name="copy-outline" size={16} color="#9ca3af" />
            </View>
          </Pressable>

          {/* ═══ RAID TAB ═══ */}
          {tab === "overview" && (
            <>
              {/* RAID TIMER CARD */}
              <View style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', 
                  borderRadius: 12, 
                  padding: 12, 
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(168, 85, 247, 0.2)',
                  alignItems: 'center', // Center content horizontally
                  justifyContent: 'center',
                  gap: 4
              }}>
                  <View style={{flexDirection:'row', alignItems:'center', gap:6, opacity: 0.7}}>
                      <Ionicons name="time" size={14} color="#a855f7" />
                      <Text style={{color:'#d1d5db', fontSize:10, fontWeight:'bold', letterSpacing: 1 }}>TIME LEFT</Text>
                  </View>
                  <Text style={{color:'#fff', fontSize:24, fontFamily:'monospace', fontWeight:'bold', letterSpacing: 2 }}>
                      {timeLeft}
                  </Text>
              </View>

              {/* Titan Status */}
              <View style={s.titanCard}>
                <View style={s.titanHeader}>
                  <Text style={s.titanName}>
                    🔥 Void Titan Lvl {raid?.titanLevel || 1}
                  </Text>
                  {/* Old timer removed */}
                  <View style={[s.weaknessBadge, { backgroundColor: WEAKNESSES.includes(todayWeakness) ? WEAKNESS_LABELS[todayWeakness]?.color + "30" : "#333" }]}>
                    <Ionicons
                      name={WEAKNESS_LABELS[todayWeakness]?.icon}
                      size={12}
                      color={WEAKNESS_LABELS[todayWeakness]?.color}
                    />
                    <Text style={[s.weaknessText, { color: WEAKNESS_LABELS[todayWeakness]?.color }]}>
                      {WEAKNESS_LABELS[todayWeakness]?.label}
                    </Text>
                  </View>
                </View>

                {/* HP Bar */}
                <View style={s.hpBarBg}>
                  <View style={[s.hpBarFill, { width: `${hpPct * 100}%` }]} />
                </View>
                <Text style={s.hpText}>
                  {raid?.defeated
                    ? "✅ DEFEATED!"
                    : `${formatDmg(raid?.totalDamage || 0)} / ${formatDmg(raid?.titanHp || 0)} HP`}
                </Text>

                {/* Attempts */}
                <Text style={s.attemptsText}>
                  Attempts: {syn.raidStatus?.attemptsUsed || 0}/{syn.raidStatus?.maxAttempts || 3}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={s.actionGrid}>
                {!raid?.defeated && syn.raidStatus?.canRaid && (
                  <Pressable 
                    style={[s.raidBtn, (syn.raidStatus?.attemptsUsed > 0) && { backgroundColor: '#db2777' }]} 
                    onPress={() => {
                        const attemptsUsed = syn.raidStatus?.attemptsUsed || 0;
                        const currentLevel = raid?.titanLevel || 1;
                        // Dynamic Cost: ~40% of Reward
                        const cost = attemptsUsed > 0 ? syn.calculateRaidCost(currentLevel) : 0;

                        if (cost > 0) {
                            if (shards < cost) {
                                showModal("Insufficient Shards", `Extra attempt costs ${cost} Shards.`, "error");
                                return;
                            }
                            
                            const estimatedReward = Math.floor(50 * Math.pow(1.6, currentLevel - 1));
                            // Full Reward (inc Shards)
                            const shardReward = 200 + (currentLevel * 50);

                            showModal(
                                "Extra Attempt",
                                `Spend ${cost} Shards for another attack?\n\n(Potential Reward: ~${shardReward} Shards + ${estimatedReward} Fragments)`,
                                "question",
                                () => {
                                    setModal(prev => ({ ...prev, visible: false }));
                                    if (onSpendShards) onSpendShards(cost);
                                    setShowRaid(true);
                                },
                                `Fight (-${cost})`,
                                "Cancel"
                            );
                        } else {
                            setShowRaid(true);
                        }
                    }}
                  >
                    <Ionicons name="flame" size={28} color="#fff" />
                    <View>
                        <Text style={s.raidBtnText}>
                            {syn.raidStatus?.attemptsUsed > 0 ? "FIGHT AGAIN" : "FIGHT TITAN"}
                        </Text>
                        {syn.raidStatus?.attemptsUsed > 0 && (
                            <Text style={{color:'#fff', fontSize:10, fontWeight:'bold'}}>
                                {syn.calculateRaidCost(raid?.titanLevel || 1)} Shards
                            </Text>
                        )}
                    </View>
                  </Pressable>
                )}

                {/* BONUS FIGHT BUTTON */}
                {raid?.defeated && !raid?.isBonus && (
                    <Pressable 
                        style={[s.raidBtn, { backgroundColor: "#f59e0b" }]} 
                        onPress={() => {
                             const cost = 100 * (raid.titanLevel || 1) + 400;
                             
                             if (shards < cost) {
                                 showModal("Insufficient Shards", `You need ${cost} Shards to revive the Titan.\nBalance: ${shards}`, "error");
                                 return;
                             }

                             showModal(
                                 "Bonus Fight",
                                 `Revive the Titan for ${cost} Shards?\n\n• Everyone can fight again\n• Earn more rewards!`,
                                 "question",
                                 async () => {
                                     setModal(prev => ({ ...prev, visible: false })); // Close confirm modal
                                     try {
                                         await syn.buyBonusFight();
                                         if (onSpendShards) onSpendShards(cost); // ✅ Deduct locally
                                         setTimeout(() => {
                                             showModal("Titan Revived!", "The Void Titan has returned! Rally the federation!", "success");
                                         }, 300);
                                     } catch(e) {
                                         setTimeout(() => {
                                             showModal("Revive Failed", e.message, "error");
                                         }, 300);
                                     }
                                 },
                                 `Revive (-${cost})`,
                                 "Cancel"
                             );
                        }}
                    >
                        <Ionicons name="refresh-circle" size={28} color="#fff" />
                        <View>
                            <Text style={s.raidBtnText}>BONUS FIGHT</Text>
                            <Text style={{color: '#fff', fontSize: 10, fontWeight: 'bold'}}>
                                {100 * (raid.titanLevel || 1) + 400} Shards
                            </Text>
                        </View>
                    </Pressable>
                )}

                {canClaim && (
                  <Pressable style={s.claimBtn} onPress={handleClaimReward}>
                    <Ionicons name="gift" size={24} color="#fff" />
                    <View>
                        <Text style={s.claimBtnText}>CLAIM REWARDS</Text>
                        <Text style={{color:'#e9d5ff', fontSize:10, fontWeight:'bold'}}>
                            ~{Math.floor(50 * Math.pow(1.6, (raid.titanLevel || 1) - 1))} Fragments
                        </Text>
                    </View>
                  </Pressable>
                )}
              </View>



              {/* Leaderboard */}
              {syn.leaderboard.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Today's Top Agents</Text>
                  {syn.leaderboard.map((entry, i) => (
                    <View key={entry.userId} style={s.lbRow}>
                      <Text style={[s.lbRank, i<3 && { color: "#fbbf24" }]}>#{i + 1}</Text>
                      <Text style={s.lbName}>{entry.displayName}</Text>
                      <Text style={s.lbDmg}>{formatDmg(entry.damage)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 📜 History Button (Below Leaderboard) */}
              <Pressable 
                  style={[s.secondaryBtn, { marginTop: 24, marginBottom: 8, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}
                  onPress={async () => {
                      const history = await syn.getHistory();
                      if (!history) {
                          showModal("No Data", "No raid data found for yesterday.", "info");
                          return;
                      }
                      
                      const allAgents = Object.values(history.contributions || {})
                          .sort((a,b) => b.damage - a.damage);
                      
                      let msg = `Titan Level: ${history.titanLevel}\n`;
                      msg += `Status: ${history.defeated ? "✅ Defeated" : "❌ Failed"}\n`;
                      msg += `Total Dmg: ${formatDmg(history.totalDamage)}\n\n`;
                      msg += `🏆 Top Agents:\n`;
                      allAgents.forEach((p, i) => {
                          msg += `#${i+1} ${p.displayName}: ${formatDmg(p.damage)}\n`;
                      });

                      showModal("Yesterday's Report", msg, "info");
                  }}
              >
                  <Text style={s.secondaryBtnText}>📜 View Previous Report</Text>
              </Pressable>

              {/* ⚡ DEBUG: RESET RAID */}
              <Pressable 
                  style={[s.raidBtn, { backgroundColor: "#111", marginTop: 20, borderWidth: 1, borderColor: '#333' }]} 
                  onPress={() => {
                        showModal(
                            "DEBUG: Reset Raid", 
                            "This will reset the Titan HP, your daily attempts, and rewards claimed status.\n\nUseful for testing infinite fights.",
                            "question",
                            async () => {
                                setModal(prev => ({ ...prev, visible: false }));
                                try {
                                    await syn.debugResetRaid();
                                    showModal("Raid Reset", "The timeline has been disrupted. The Titan is fresh.", "success");
                                } catch(e) {
                                    showModal("Reset Failed", e.message, "error");
                                }
                            },
                            "RESET RAID",
                            "Cancel"
                        );
                  }}
              >
                  <Ionicons name="bug" size={24} color="#ef4444" />
                  <Text style={[s.raidBtnText, { color: "#ef4444" }]}>DEBUG: RESET RAID</Text>
              </Pressable>
            </>
          )}

          {/* ═══ MEMBERS TAB ═══ */}
          {tab === "members" && (
            <View style={s.section}>
              {syn.members.map((m) => (
                <View key={m.id} style={s.memberRow}>
                  <View style={s.memberIcon}>
                    <Ionicons
                      name={m.id === fed.leaderId ? "star" : "person"}
                      size={18}
                      color={m.id === fed.leaderId ? "#fbbf24" : "#888"}
                    />
                  </View>
                  <View style={s.memberInfo}>
                    <Text style={s.memberName}>{m.displayName}</Text>
                    <Text style={s.memberSub}>
                      {m.specialty ? SPECIALTIES.find((d) => d.id === m.specialty)?.label : "No Specialty"} 
                      {m.specialtyLevel > 0 ? ` Lvl ${m.specialtyLevel}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                     <Text style={[s.memberSub, { color: "#a855f7" }]}>{formatDmg(m.federationPower || 0)} FP</Text>
                  </View>
                </View>
              ))}

              <Pressable style={s.leaveBtn} onPress={handleLeave}>
                <Ionicons name="exit" size={18} color="#ef4444" />
                <Text style={s.leaveBtnText}>Leave Federation</Text>
              </Pressable>
            </View>
          )}

          {/* ═══ SPECIALTY TAB ═══ */}
          {tab === "specialty" && (
            <View style={s.section}>
              <Text style={s.sectionSub}>
                Choose a Specialty. 
                Match the Titan's weakness for +25% bonus damage!
              </Text>
              
              <View style={s.shardsBox}>
                <Ionicons name="diamond" size={20} color="#a855f7" />
                 <Text style={s.shardsText}>
                  {syn.userProfile?.titanFragments || 0} Titan Fragments
                </Text>
              </View>

              {SPECIALTIES.map((d) => {
                const isActive = syn.userProfile?.specialty === d.id;
                const isCounter = d.weakness === todayWeakness;
                return (
                  <View key={d.id} style={[s.doctrineCard, isActive && { borderColor: d.color, backgroundColor: d.color + "10" }]}>
                    <View style={[s.doctrineIconBox, { backgroundColor: d.color + "20" }]}>
                      <Ionicons name={d.icon} size={24} color={d.color} />
                    </View>
                    <View style={s.doctrineInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[s.doctrineName, { color: d.color }]}>{d.label}</Text>
                        {isCounter && (
                          <Text style={s.counterBadge}>⚡ COUNTER</Text>
                        )}
                      </View>
                      <Text style={s.doctrineDesc}>{d.desc}</Text>
                      {isActive && (
                        <View>
                            <Text style={s.doctrineLvl}>
                              Lvl {syn.userProfile?.specialtyLevel || 0}
                            </Text>
                            <Text style={{color:'#aaa', fontSize:10}}>
                              Dmg: {formatDmg(100 * Math.pow(2.1, syn.userProfile?.specialtyLevel || 0))}
                              {' -> '}
                              <Text style={{color:'#a855f7'}}>
                                  {formatDmg(100 * Math.pow(2.1, (syn.userProfile?.specialtyLevel || 0) + 1))}
                              </Text>
                            </Text>
                        </View>
                      )}
                    </View>
                    {isActive ? (
                      <Pressable
                        style={[
                            s.actionBtnSmall,
                            { backgroundColor: d.color },
                            (syn.userProfile?.titanFragments || 0) < Math.floor(100 * Math.pow(1.5, syn.userProfile?.specialtyLevel || 0)) && { opacity: 0.5, backgroundColor: '#555' }
                        ]}
                        disabled={(syn.userProfile?.titanFragments || 0) < Math.floor(100 * Math.pow(1.5, syn.userProfile?.specialtyLevel || 0))}
                        onPress={async () => {
                             const lvl = syn.userProfile?.specialtyLevel || 0;
                             const cost = Math.floor(100 * Math.pow(1.5, lvl));
                             
                             if ((syn.userProfile?.titanFragments || 0) < cost) return; 

                             try {
                                 await syn.levelUpDoctrine();
                                 showModal("Success", "Specialty upgraded!", "success");
                             } catch(e) {
                                 showModal("Upgrade Failed", e.message, "error");
                             }
                        }}
                      >
                        <Text style={s.actionBtnText}>
                            {(syn.userProfile?.titanFragments || 0) < Math.floor(100 * Math.pow(1.5, syn.userProfile?.specialtyLevel || 0))
                                ? `Need ${Math.floor(100 * Math.pow(1.5, syn.userProfile?.specialtyLevel || 0))} 💎`
                                : `Upgrade (${Math.floor(100 * Math.pow(1.5, syn.userProfile?.specialtyLevel || 0))} 💎)`}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[s.actionBtnSmall, { backgroundColor: "rgba(255,255,255,0.1)" }]}
                        onPress={async () => {
                             try {
                                 await syn.chooseDoctrine(d.id);
                                 showModal("Success", `${d.label} selected!`, "success");
                             } catch(e) {
                                 showModal("Selection Failed", e.message, "error");
                             }
                        }}
                      >
                        <Text style={s.actionBtnText}>Select</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Titan Raid Modal */}
      <TitanRaidModal
        visible={showRaid}
        onClose={() => {
          setShowRaid(false);
          syn.refresh();
        }}
        syndicateHook={syn}
      />

        {/* Global Modal for Alerts */}
        <NiceModal 
            visible={modal.visible}
            title={modal.title}
            message={modal.message}
            type={modal.type}
            onConfirm={modal.onConfirm}
            confirmText={modal.confirmText}
            cancelText={modal.cancelText}
            onClose={() => setModal(prev => ({ ...prev, visible: false }))}
        />
    </Modal>
  );
}

// ─── Utilities ───
function formatDmg(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toString();
}

// ─── Styles ───
const s = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: "#111827", // Dark solid background 
  },
  loadingText: { color: "#fff", marginTop: 20 },
  
  // Center Box (No Federation / Profile)
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
  },
  heroSub: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 22,
  },
  
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: 50,
  },
  title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
  },
  
  // Forms
  formBox: {
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 20,
  },
  formTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  inputLabel: { color: "#a855f7", fontSize: 12, fontWeight: "bold", marginBottom: 8, letterSpacing: 1 },
  inputBig: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    textAlign: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  
  // Buttons
  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#7e22ce",
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  
  btnRow: { flexDirection: "row", gap: 10 },
  primaryBtnSmall: {
    flex: 1,
    backgroundColor: "#7e22ce",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#ccc", fontWeight: "600" },
  
  // Options
  bigOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    width: "100%",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
    marginBottom: 16,
    gap: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#7e22ce",
    justifyContent: "center",
    alignItems: "center",
  },
  optionTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  optionSub: { color: "#888", fontSize: 13, marginTop: 4 },
  
  // Close Buttons
  closeBtn: { padding: 4 },
  closeBtnAbsolute: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 10 },
  
  // App Bar (In Federation)
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  backBtn: { padding: 4 },
  appBarTitle: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "center" },
  appBarSub: { color: "#a855f7", fontSize: 12, textAlign: "center" },
  
  // Invite Card
  inviteCard: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(168,85,247,0.1)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  inviteLabel: { color: "#a855f7", fontSize: 10, letterSpacing: 2, fontWeight: "bold" },
  inviteCode: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 4, marginTop: 4 },
  
  // Tabs
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabActive: { backgroundColor: "#7e22ce", borderBottomWidth: 0 },
  tabText: { color: "#888", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  
  // Body
  body: { flex: 1 },
  
  // Titan Card
  titanCard: {
    margin: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  titanHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  titanName: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  weaknessBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  weaknessText: { fontSize: 11, fontWeight: "bold" },
  
  hpBarBg: { height: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 6, overflow: "hidden", marginBottom: 8 },
  hpBarFill: { height: "100%", backgroundColor: "#ef4444", borderRadius: 6 },
  hpText: { color: "#ccc", textAlign: "center", fontSize: 12 },
  attemptsText: { textAlign: "center", color: "#666", fontSize: 11, marginTop: 8 },
  
  actionGrid: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  raidBtn: {
    flex: 1,
    backgroundColor: "#dc2626",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 4,
  },
  raidBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  claimBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  claimBtnText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  
  // Leaderboard
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: "#a855f7", fontSize: 14, fontWeight: "bold", marginBottom: 12, letterSpacing: 1 },
  sectionSub: { color: "#888", fontSize: 13, marginBottom: 16, lineHeight: 20 },
  
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  lbRank: { width: 30, color: "#888", fontWeight: "bold" },
  lbName: { flex: 1, color: "#fff" },
  lbDmg: { color: "#ef4444", fontWeight: "bold" },
  
  // Members
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberInfo: { flex: 1 },
  memberName: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  memberSub: { color: "#888", fontSize: 12 },
  
  leaveBtn: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.5)",
    borderRadius: 12,
  },
  leaveBtnText: { color: "#ef4444", fontWeight: "bold" },
  
  // Specialty
  doctrineCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  doctrineIconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  doctrineInfo: { flex: 1 },
  doctrineName: { fontWeight: "bold", fontSize: 15 },
  doctrineDesc: { color: "#aaa", fontSize: 12, marginTop: 4 },
  doctrineLvl: { color: "#a855f7", fontSize: 12, marginTop: 6, fontWeight: "600" },
  counterBadge: { color: "#fbbf24", fontSize: 10, fontWeight: "bold", backgroundColor: "rgba(251,191,36,0.1)", alignSelf: "flex-start", paddingHorizontal: 4, borderRadius: 4 },
  
  actionBtnSmall: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  
  shardsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  shardsText: { color: "#a855f7", fontWeight: "bold", fontSize: 16 },

  // Search Results
  searchResultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 8,
      marginBottom: 8,
  },
  resultName: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  resultSub: { color: "#aaa", fontSize: 12 },
  joinBtnSmall: {
      backgroundColor: "#22c55e",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 6,
  },
  joinBtnText: { color: "#fff", fontWeight: "bold", fontSize: 11 },
});
