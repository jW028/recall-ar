import { PairingService } from '@/services/PairingService';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
 
type ScanState = 'scanning' | 'processing' | 'error';
 
export default function PairDeviceScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [error, setError] = useState<string | null>(null);
 
  // Prevent processing multiple scans in quick succession
  const [hasScanned, setHasScanned] = useState(false);
 
  useEffect(() => {
    // If the device is already paired, skip straight to the patient app
    PairingService.getPersistedPairing().then((info) => {
      if (info) router.replace('/(patient)');
    });
  }, []);
 
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (hasScanned) return;
    setHasScanned(true);
    setScanState('processing');
    setError(null);
 
    // QR code encodes just the raw token string
    const result = await PairingService.pairDevice(data.trim());
 
    if (result.success) {
      router.replace('/(patient)');
      return;
    }
 
    setError(result.error);
    setScanState('error');
    // Allow a retry after showing the error
    setTimeout(() => setHasScanned(false), 3000);
  };
 
  // Permission not yet determined 
  if (!permission) {
    return <View style={styles.container} />;
  }
 
  // Permission denied 
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.body}>
          RecallAR needs camera access to scan the setup QR code from the
          caregiver's phone.
        </Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Allow camera access</Text>
        </Pressable>
      </View>
    );
  }
 
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set up this device</Text>
      <Text style={styles.body}>
        Ask the caregiver to open RecallAR on their phone, go to{' '}
        <Text style={styles.bold}>Manage Patient → Pair Device</Text>, and
        hold the QR code up to this screen.
      </Text>
 
      {/* QR Scanner */}
      <View style={styles.scannerWrapper}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            scanState === 'scanning' ? handleBarCodeScanned : undefined
          }
        />
 
        {/* Corner guides */}
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
 
        {/* Processing overlay */}
        {scanState === 'processing' && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.overlayText}>Setting up…</Text>
          </View>
        )}
      </View>
 
      {/* Error message */}
      {scanState === 'error' && error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
 
      <Text style={styles.hint}>This step only needs to be done once.</Text>
    </View>
  );
}
 
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = '#2563EB';
 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  bold: {
    fontWeight: '700',
    color: '#111827',
  },
  scannerWrapper: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 320,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    marginBottom: 24,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  topLeft: {
    top: 16,
    left: 16,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  topRight: {
    top: 16,
    right: 16,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  bottomLeft: {
    bottom: 16,
    left: 16,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  bottomRight: {
    bottom: 16,
    right: 16,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
 
