import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from "react-native";
import NiceModal from "./NiceModal";

export default function DevToolsModal({ visible, onClose, engine }) {
  if (__DEV__) console.log("DevToolsModal Render. Visible:", visible);
  const [warpZone, setWarpZone] = useState("");
  
  // Modal State
  const [modal, setModal] = useState({
      visible: false,
      title: "",
      message: "",
      type: "info",
      onConfirm: null,
      confirmText: "OK",
      cancelText: "Cancel",
  });

  const showModal = (title, message, type = "info", onConfirm = null, confirmText = "OK", cancelText = "Cancel") => {
      setModal({
          visible: true,
          title,
          message,
          type,
          onConfirm,
          confirmText,
          cancelText,
      });
  };

  if (!visible) return null;

  const handleWarp = () => {
    const z = parseInt(warpZone, 10);
    if (!isNaN(z) && z > 0) {
       engine.setZone(z);
       engine.setStep(1);
       // Also update max unlocked to allowing farming there
       if (z > (engine.maxUnlockedZone || 1)) {
           engine.setMaxUnlockedZone(z);
       }
       showModal("Warped", `Welcome to Zone ${z}`, "success");
    }
  };

  const addMinerals = () => {
     engine.dispatchEco({ type: "GAIN_MINERALS", amount: 1e15 }); // 1 Quadrillion
     showModal("Rich!", "Added 1Q Minerals", "success");
  };

  const addFragments = () => {
     engine.dispatchEco({ type: "GAIN_FRAGMENTS", amount: 1000 });
     showModal("Star Power", "Added 1000 Fragments", "success");
  };
  
  const addTags = () => {
      // Add 5 Random Tags
      engine.dispatchEco({ type: "GAIN_TAG", amount: 5 });
      showModal("Gilded!", "Added 5 Random Starlink Tags", "success");
  };

  const addTagsToFirst5 = () => {
      // Give 1 tag to each of the first 5 miners (miner_01 to miner_05)
      // We dispatch ONE by ONE or create a bulk payload?
      // Our reducer GAIN_TAG takes targetMinerId.
      // We'll just dispatch 5 times. React batching might handle it, or useGameEngine state updates.
      // Better: Dispatch separate.
      ["miner_01", "miner_02", "miner_03", "miner_04", "miner_05"].forEach(id => {
          engine.dispatchEco({ type: "GAIN_TAG", targetMinerId: id, amount: 1 });
      });
      showModal("Gilded!", "Gave 1 Tag to first 5 miners.", "success");
  };
  
  const resetGame = () => {
      engine.resetGame();
      onClose();
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="auto">
        <View style={styles.container}>
          <LinearGradient
            colors={["#1e293b", "#0f172a"]}
            style={styles.content}
          >
            <View style={styles.header}>
              <Text style={styles.title}>DEV TOOLS 🛠️</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scroll}>
              
              {/* WARP */}
              <View style={styles.section}>
                <Text style={styles.label}>Warp to Zone</Text>
                <View style={styles.row}>
                  <TextInput 
                    style={styles.input} 
                    keyboardType="numeric" 
                    placeholder="Zone ID"
                    placeholderTextColor="#666"
                    value={warpZone}
                    onChangeText={setWarpZone}
                  />
                  <Pressable style={styles.btn} onPress={handleWarp}>
                    <Text style={styles.btnTxt}>WARP</Text>
                  </Pressable>
                </View>
              </View>

              {/* CHEATS */}
              <View style={styles.section}>
                <Text style={styles.label}>Resources</Text>
                <View style={styles.grid}>
                   <Pressable style={styles.cheatBtn} onPress={addMinerals}>
                      <Ionicons name="diamond" size={18} color="#60a5fa" />
                      <Text style={styles.cheatTxt}>+1Q Minerals</Text>
                   </Pressable>
                   <Pressable style={styles.cheatBtn} onPress={addFragments}>
                      <Ionicons name="star" size={18} color="#a855f7" />
                      <Text style={styles.cheatTxt}>+1k Fragments</Text>
                   </Pressable>
                   <Pressable style={styles.cheatBtn} onPress={addTags}>
                      <Ionicons name="star-four-points" size={18} color="#ffd700" />
                      <Text style={styles.cheatTxt}>+5 Random Tags</Text>
                   </Pressable>
                   <Pressable style={styles.cheatBtn} onPress={addTagsToFirst5}>
                      <Ionicons name="list" size={18} color="#fbbf24" />
                      <Text style={styles.cheatTxt}>First 5 Tags</Text>
                   </Pressable>
                </View>
              </View>

              {/* SKILLS */}
              <View style={styles.section}>
                <Text style={styles.label}>Skills</Text>
                <View style={styles.grid}>
                   <Pressable style={styles.cheatBtn} onPress={() => {
                       engine.resetSkillCooldowns();
                       showModal("Refreshed", "Skill Cooldowns Reset", "success");
                   }}>
                      <Ionicons name="refresh-circle" size={18} color="#fbbf24" />
                      <Text style={styles.cheatTxt}>Reset Cooldowns</Text>
                   </Pressable>
                </View>
              </View>
              
               {/* DANGER */}
              <View style={styles.section}>
                 <Text style={[styles.label, {color: '#ef4444'}]}>Danger Zone</Text>
                 <Pressable style={styles.cheatBtn} onPress={() => {
                     engine.dispatchEco({ type: "DEBUG_ADD_ARTIFACT" });
                     showModal("Artifact Grant", "Added Random Artifact (Lv.100)", "success");
                 }}>
                      <Ionicons name="trophy" size={18} color="#fca5a5" />
                      <Text style={styles.cheatTxt}>+Artifact</Text>
                 </Pressable>
                 
                 <Pressable style={styles.cheatBtn} onPress={() => {
                     engine.dispatchEco({ type: "GRANT_EXPLORER" });
                     showModal("Explorer Grant", "Added Random Explorer!", "success");
                 }}>
                      <Ionicons name="rocket" size={18} color="#60a5fa" />
                      <Text style={styles.cheatTxt}>+Explorer</Text>
                 </Pressable>
                 
                 <Pressable style={[styles.btn, {backgroundColor: '#ef4444', marginTop: 10}]} onPress={resetGame}>
                    <Text style={styles.btnTxt}>HARD RESET</Text>
                 </Pressable>
              </View>

            </ScrollView>
          </LinearGradient>
        </View>

        {/* NiceModal */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
    zIndex: 9999, // ✅ Topmost
  },
  container: {
    borderRadius: 16,
    overflow: "hidden",
    maxHeight: "80%",
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  scroll: {
    gap: 20,
  },
  section: {
    gap: 10,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  btn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    justifyContent: "center",
    borderRadius: 8,
  },
  btnTxt: {
    color: "#fff",
    fontWeight: "bold",
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  cheatBtn: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
  },
  cheatTxt: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 12
  }
});
