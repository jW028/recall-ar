import { ActionRow } from '@/components/caregiver/ActionRow';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function AccountScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const clearAuth = useAuthStore((s) => s.clearAuth);
    const mode = useThemeStore((s) => s.mode);
    const setMode = useThemeStore((s) => s.setMode);

    const handleSignOut = async () => {
        await AuthService.signOut();
        clearAuth();
    };

    return (
        <Screen background="page">
            <ScreenHeader title="Account" showBack />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileCard}>
                    <Avatar
                        imageUrl={user?.imageUrl}
                        name={user?.fullName || user?.email || '?'}
                        size={60}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{user?.fullName || 'Caregiver'}</Text>
                        <Text style={styles.email}>{user?.email}</Text>
                        {!!user?.contact && <Text style={styles.contact}>{user.contact}</Text>}
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Profile</Text>
                <ActionRow
                    icon="person-outline"
                    label="Edit profile"
                    onPress={() => router.push('/(caregiver)/home/edit-profile')}
                />
                <ActionRow
                    icon="lock-closed-outline"
                    label="Change password"
                    onPress={() => router.push('/(caregiver)/home/change-password')}
                />

                <Text style={styles.sectionLabel}>Appearance</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowLeft}>
                            <Ionicons name="moon-outline" size={20} color={theme.bodySecondary} />
                            <Text style={styles.rowLabel}>Dark mode</Text>
                        </View>
                        <Switch
                            value={mode === 'dark'}
                            onValueChange={(on) => setMode(on ? 'dark' : 'light')}
                            trackColor={{ false: theme.borderStrong, true: theme.primary }}
                        />
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Help & Legal</Text>
                <ActionRow
                    icon="shield-checkmark-outline"
                    label="Privacy Declaration"
                    onPress={() => router.push('/(caregiver)/home/privacy')}
                />
                <ActionRow
                    icon="document-text-outline"
                    label="Terms & Conditions"
                    onPress={() => router.push('/(caregiver)/home/terms')}
                />

                <View style={styles.signOut}>
                    <Button label="Sign out" variant="destructive" icon="log-out-outline" onPress={handleSignOut} />
                </View>
            </ScrollView>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        content: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 24,
            gap: 16,
        },
        profileCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 20,
        },
        profileInfo: {
            flex: 1,
        },
        name: {
            fontSize: 19,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 2,
        },
        email: {
            fontSize: 14,
            color: theme.textMuted,
        },
        contact: {
            fontSize: 14,
            color: theme.textMuted,
            marginTop: 2,
        },
        sectionLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginLeft: 4,
            marginBottom: -8,
        },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 16,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 14,
        },
        rowLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        rowLabel: {
            fontSize: 16,
            color: theme.body,
        },
        signOut: {
            marginTop: 8,
        },
    });
}
