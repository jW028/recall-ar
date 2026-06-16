import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function MainScreen() {
	const theme = useTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.container}>
			<View style={styles.card}>
				<Text style={styles.kicker}>RecallAR</Text>
				<Text style={styles.title}>Welcome</Text>
				<Text style={styles.subtitle}>
					Sign in to continue or create a caregiver account.
				</Text>

				<View style={styles.actions}>
					<Link href="/login" asChild>
						<Pressable style={styles.primaryButton}>
							<Text style={styles.primaryButtonText}>Login</Text>
						</Pressable>
					</Link>

					<Link href="/register" asChild>
						<Pressable style={styles.secondaryButton}>
							<Text style={styles.secondaryButtonText}>Sign up</Text>
						</Pressable>
					</Link>
				</View>
			</View>
		</View>
	);
}

function createStyles(theme: Theme) {
	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.pageBackground,
			padding: 24,
			justifyContent: 'center',
		},
		card: {
			backgroundColor: theme.surface,
			borderRadius: 24,
			padding: 24,
			gap: 12,
			shadowColor: theme.heading,
			shadowOpacity: 0.08,
			shadowRadius: 24,
			shadowOffset: { width: 0, height: 12 },
			elevation: 3,
		},
		kicker: {
			fontSize: 14,
			fontWeight: '700',
			letterSpacing: 1.2,
			textTransform: 'uppercase',
			color: theme.primary,
		},
		title: {
			fontSize: 34,
			lineHeight: 40,
			fontWeight: '800',
			color: theme.heading,
		},
		subtitle: {
			fontSize: 16,
			lineHeight: 24,
			color: theme.bodySecondary,
			marginBottom: 8,
		},
		actions: {
			gap: 12,
			marginTop: 8,
		},
		primaryButton: {
			backgroundColor: theme.primary,
			borderRadius: 14,
			paddingVertical: 16,
			alignItems: 'center',
		},
		primaryButtonText: {
			color: theme.onPrimary,
			fontSize: 16,
			fontWeight: '700',
		},
		secondaryButton: {
			backgroundColor: theme.buttonSecondaryBackground,
			borderRadius: 14,
			paddingVertical: 16,
			alignItems: 'center',
		},
		secondaryButtonText: {
			color: theme.heading,
			fontSize: 16,
			fontWeight: '700',
		},
	});
}