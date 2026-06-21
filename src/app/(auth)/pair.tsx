import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PairingService } from '@/services/PairingService';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
 
type ScanState = 'scanning' | 'processing' | 'error';
 
export default function PairDeviceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [error, setError] = useState<string | null>(null);
 
  // Prevent processing multiple scans in quick succession
  const [hasScanned, setHasScanned] = useState(false);
  const [devToken, setDevToken] = useState('');
 
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
            <ActivityIndicator size="large" color={theme.onPrimary} />
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

      {__DEV__ && (
        <View style={styles.devSection}>
          <Text style={styles.devLabel}>⚙ DEV: Paste token manually</Text>
          <TextInput
            style={styles.devInput}
            value={devToken}
            onChangeText={setDevToken}
            placeholder="Paste token here"
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.devButton}
            onPress={() => {
              if (devToken.trim()) handleBarCodeScanned({ data: devToken.trim() });
            }}
            disabled={scanState === 'processing' || !devToken.trim()}
          >
            <Text style={styles.devButtonText}>Submit token</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
 
const CORNER_SIZE = 24;
const CORNER_THICKNESS = 4;

function createStyles(theme: Theme) {
  // CORNER_COLOR sits alongside the non-color layout constants above but must be
  // computed from the theme, so it lives here instead of at module scope.
  const CORNER_COLOR = theme.primary;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.body,
      marginBottom: 12,
      textAlign: 'center',
    },
    body: {
      fontSize: 16,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
    },
    bold: {
      fontWeight: '700',
      color: theme.body,
    },
    scannerWrapper: {
      width: '100%',
      aspectRatio: 1,
      maxWidth: 320,
      borderRadius: 16,
      overflow: 'hidden',
      // Intentionally theme-invariant: this is the camera viewfinder's fallback
      // background before the feed paints, and should stay black in light mode too.
      backgroundColor: theme.scrim,
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
      backgroundColor: theme.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    overlayText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    errorBox: {
      backgroundColor: theme.errorBackground,
      borderColor: theme.errorBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      width: '100%',
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      textAlign: 'center',
    },
    hint: {
      fontSize: 14,
      color: theme.textFaint,
      textAlign: 'center',
    },
    devSection: {
      width: '100%',
      marginTop: 32,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 8,
      gap: 8,
    },
    devLabel: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 4,
    },
    devInput: {
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 13,
      color: theme.body,
      backgroundColor: theme.cardBackground,
    },
    devButton: {
      backgroundColor: theme.primaryMuted,
      borderRadius: 6,
      paddingVertical: 10,
      alignItems: 'center',
    },
    devButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primaryText,
    },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: 'center',
      marginTop: 24,
    },
    buttonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
 
