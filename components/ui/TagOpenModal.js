import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import minersDef from "../../assets/config/miners.json";

// Placeholder image
const MINER_IMG = require("../../assets/images/sprites/miners/miner_01.png");

export default function TagOpenModal({ visible, unopenedCount, onOpenTag, onClose, lastOpenedMinerId, onReset }) {
    const [state, setState] = useState("CHEST"); // CHEST, OPENING, REVEALED
    const [revealedMiner, setRevealedMiner] = useState(null);
    const [autoOpen, setAutoOpen] = useState(false);

    // Animations
    const scale = useRef(new Animated.Value(1)).current;
    const shake = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;
    const lightRotate = useRef(new Animated.Value(0)).current;

    // Reset when modal opens
    useEffect(() => {
        if (visible) {
            setState("CHEST");
            setAutoOpen(false);
            scale.setValue(1);
            fade.setValue(0);
        }
    }, [visible]);

    // State Machine: CHEST -> RESETTING -> OPENING -> REVEALED
    
    // Watch for State Transitions
    useEffect(() => {
        // 1. If RESETTING and ID is null, we are ready to open
        if (state === "RESETTING" && !lastOpenedMinerId) {
            console.log("TagModal: Reset Complete. Starting Open...");
            handleOpen();
        }

        // 2. If OPENING and ID is present, we have a result
        if (state === "OPENING" && lastOpenedMinerId) {
            console.log("TagModal: Result Received! Revealing...");
            const m = minersDef.find(m => m.id === lastOpenedMinerId);
            setRevealedMiner(m || { name: "Unknown Miner" });
            
            setTimeout(() => {
                setState("REVEALED");
                Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
                
                Animated.loop(
                    Animated.timing(lightRotate, {
                        toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true
                    })
                ).start();

            }, 500);
        }
    }, [lastOpenedMinerId, state]); 

    const handleOpen = () => {
        // Only start opening if Chest (First time) or Resetting (Next time)
        if (state !== "CHEST" && state !== "RESETTING") return;
        
        setState("OPENING");
        
        // Rumble Animation
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.1, duration: 200, useNativeDriver: true }),
            Animated.loop(
                Animated.sequence([
                    Animated.timing(shake, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shake, { toValue: -10, duration: 50, useNativeDriver: true }),
                ]),
                { iterations: 5 }
            ),
            Animated.spring(scale, { toValue: 0, duration: 200, useNativeDriver: true }) // Shrink out
        ]).start(() => {
            shake.setValue(0);
            console.log("TagModal: Anim done. Dispatching Open Action.");
            if (onOpenTag) onOpenTag(); 
        });
    };

    const handleNext = () => {
        console.log("TagModal: Next Clicked. Resetting...");
        
        // 1. Trigger Reset Action
        if (onReset) onReset();

        // 2. Enter Resetting State (Wait for ID to be null)
        setState("RESETTING");
        scale.setValue(1);
        fade.setValue(0);
    };

    const handleResetToChest = () => {
        setState("CHEST");
        scale.setValue(1);
        fade.setValue(0);
    };

    const spin = lightRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                {/* Close Button (Hide in Batch Mode / AutoOpen) */}
                {!autoOpen && state === "CHEST" && (
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                )}

                <View style={styles.card}>
                    <Text style={styles.title}>STELLAR TAG FOUND!</Text>
                    <Text style={styles.subtitle}>{unopenedCount} Unopened Tags</Text>

                    <View style={styles.stage}>
                        {state === "CHEST" || state === "OPENING" ? (
                            <TouchableOpacity onPress={handleOpen} disabled={state !== "CHEST" || autoOpen} activeOpacity={0.9}>
                                <Animated.View style={{ 
                                    transform: [
                                        { scale }, 
                                        { translateX: shake }
                                    ] 
                                }}>
                                    <MaterialCommunityIcons name="treasure-chest" size={120} color="#fbbf24" />
                                </Animated.View>
                                {state === "CHEST" && !autoOpen && <Text style={styles.tapText}>TAP TO OPEN</Text>}
                                {state === "CHEST" && autoOpen && <Text style={styles.tapText}>OPENING...</Text>}
                            </TouchableOpacity>
                        ) : (
                            <Animated.View style={[styles.revealBox, { opacity: fade }]}>
                                {/* Rotating Light Behind */}
                                <Animated.View style={[styles.lightRay, { transform: [{ rotate: spin }] }]}>
                                    <MaterialCommunityIcons name="star-four-points" size={200} color="#fbbf24" style={{opacity: 0.2}} />
                                </Animated.View>

                                <Image source={MINER_IMG} style={styles.minerImg} />
                                <Text style={styles.mName}>{revealedMiner?.name}</Text>
                                <Text style={styles.bonus}>+50% DAMAGE!</Text>
                                
                                {/* ACTIONS: Next or Done */}
                                <View style={{gap: 10, marginTop: 10}}>
                                    {unopenedCount > 0 ? (
                                        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.8}>
                                            <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                                                <Text style={styles.nextTxt}>NEXT TAG</Text>
                                                <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
                                            <Text style={styles.doneTxt}>DONE</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                            </Animated.View>
                        )}
                    </View>

                    {/* Footer Actions (Initially) */}
                    {state === "CHEST" && !autoOpen && unopenedCount > 1 && (
                        <TouchableOpacity 
                            style={styles.openAllBtn} 
                            onPress={() => {
                                setAutoOpen(true); // Enable Batch Mode
                                handleOpen(); // Start first one
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.openAllTxt}>OPEN ALL ({unopenedCount})</Text>
                            <MaterialCommunityIcons name="fast-forward" size={16} color="#000" />
                        </TouchableOpacity>
                    )}
                    
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "center",
        alignItems: "center",
    },
    card: {
        width: 320,
        backgroundColor: "#111827",
        borderRadius: 24,
        padding: 24,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#fbbf24",
        shadowColor: "#fbbf24",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        color: "#fbbf24",
        fontSize: 20,
        fontWeight: "900",
        letterSpacing: 1,
        marginBottom: 4,
    },
    subtitle: {
        color: "#9ca3af",
        fontSize: 14,
        marginBottom: 32,
    },
    stage: {
        height: 250,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    tapText: {
        color: "#fff",
        marginTop: 16,
        fontWeight: "bold",
        opacity: 0.8,
        textAlign: 'center'
    },
    revealBox: {
        alignItems: "center",
        justifyContent: "center",
        width: '100%'
    },
    minerImg: {
        width: 100,
        height: 100,
        resizeMode: "contain",
        marginBottom: 16,
    },
    mName: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 4,
        textAlign: 'center'
    },
    bonus: {
        color: "#4ade80",
        fontSize: 16,
        fontWeight: "800",
        marginBottom: 24,
    },
    lightRay: {
        position: 'absolute',
        zIndex: -1,
    },
    nextBtn: {
        backgroundColor: "#2563eb",
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextTxt: {
        color: "#fff",
        fontWeight: "bold",
        fontSize: 16
    },
    openAllBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#fbbf24",
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 8,
    },
    openAllTxt: {
        color: "#000",
        fontWeight: "bold",
    },
    closeBtn: {
        position: 'absolute',
        top: 60,
        right: 30,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    doneBtn: {
        backgroundColor: "#4ade80", // Green for Done
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 12,
    },
    doneTxt: {
        color: "#064e3b",
        fontWeight: "bold",
        fontSize: 16
    }
});
