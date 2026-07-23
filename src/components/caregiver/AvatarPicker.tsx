import { Avatar } from '@/components/common/Avatar';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface AvatarPickerProps {
    value: string | null;
    name: string;
    onChange: (uri: string | null) => void;
    size?: number;
}

// Editable patient avatar: tap to pick from camera or library, or remove an existing picture
export function AvatarPicker({ value, name, onChange, size = 96 }: AvatarPickerProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    async function pickFromCamera() {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Camera access needed', 'Please enable camera access in Settings to take photos.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
    }

    async function pickFromLibrary() {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Photo library access needed', 'Please enable photo library access in Settings to pick photos.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
    }

    function openPicker() {
        // Offer Remove only when a picture already exists
        const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
            { text: 'Camera', onPress: pickFromCamera },
            { text: 'Photo library', onPress: pickFromLibrary },
        ];
        if (value) options.push({ text: 'Remove photo', style: 'destructive', onPress: () => onChange(null) });
        options.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Profile picture', 'Choose a source', options);
    }

    return (
        <View style={styles.container}>
            <Pressable onPress={openPicker} style={styles.pressable} accessibilityLabel="Change profile picture">
                <Avatar imageUrl={value} name={name} size={size} />
                <View style={styles.badge}>
                    <Ionicons name="camera" size={16} color={theme.onPrimary} />
                </View>
            </Pressable>
            <Pressable onPress={openPicker} hitSlop={8}>
                <Text style={styles.editText}>{value ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            alignItems: 'center',
            gap: 8,
        },
        pressable: {
            position: 'relative',
        },
        badge: {
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: theme.surface,
        },
        editText: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.primary,
        },
    });
}
