
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Index() {
	const theme = useTheme();
	const styles = useMemo(() => createStyles(theme), [theme]);

	return (
		<View style={styles.container}>
			<View style={styles.hero}>
				<Text style={styles.kicker}>RecallAR</Text>
				<Text style={styles.title}>Care support made simple.</Text>
				<Text style={styles.subtitle}>
					Log in to continue or create a caregiver account to get started.
				</Text>
			</View>

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
	);
}

function createStyles(theme: Theme) {
	return StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.pageBackground,
			paddingHorizontal: 24,
			paddingVertical: 48,
			justifyContent: 'center',
		},
		hero: {
			gap: 12,
			marginBottom: 32,
		},
		kicker: {
			fontSize: 14,
			fontWeight: '700',
			letterSpacing: 1.2,
			textTransform: 'uppercase',
			color: theme.primary,
		},
		title: {
			fontSize: 36,
			lineHeight: 42,
			fontWeight: '800',
			color: theme.heading,
		},
		subtitle: {
			fontSize: 16,
			lineHeight: 24,
			color: theme.bodySecondary,
			maxWidth: 360,
		},
		actions: {
			gap: 12,
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