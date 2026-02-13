import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export default function NiceModal({ visible, title, message, type = "info", onClose, onConfirm, confirmText = "Confirm", cancelText = "Cancel" }) {
  if (!visible) return null;

  const isError = type === "error";
  const icon = isError ? "alert-circle" : type === "success" ? "checkmark-circle" : "information-circle";
  const color = isError ? "#ef4444" : type === "success" ? "#10b981" : "#a855f7";
  const gradient = isError 
    ? ["rgba(239, 68, 68, 0.2)", "rgba(127, 29, 29, 0.4)"]
    : type === "success" 
      ? ["rgba(16, 185, 129, 0.2)", "rgba(6, 78, 59, 0.4)"]
      : ["rgba(168, 85, 247, 0.2)", "rgba(88, 28, 135, 0.4)"];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={gradient} style={styles.gradient} />
          
          <View style={[styles.iconBox, { borderColor: color + "40" }]}>
            <Ionicons name={icon} size={48} color={color} />
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          {onConfirm ? (
            <View style={styles.btnRow}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, { backgroundColor: color }]} onPress={onConfirm}>
                <Text style={styles.btnText}>{confirmText}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={[styles.btn, { backgroundColor: color }]} onPress={onClose}>
              <Text style={styles.btnText}>OK</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1f2937',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  iconBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 50,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#ccc',
    fontWeight: '600',
    fontSize: 16,
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
