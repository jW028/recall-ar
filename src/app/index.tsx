
import { Button } from '@/components/common/Button';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
	const theme = useTheme();
	const router = useRouter();
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
				<Button label="Login" onPress={() => router.push('/login')} />
				<Button label="Sign up" variant="secondary" onPress={() => router.push('/register')} />
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
	});
}