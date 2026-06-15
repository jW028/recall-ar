import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function MainScreen() {
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

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F3F7FC',
		padding: 24,
		justifyContent: 'center',
	},
	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: 24,
		padding: 24,
		gap: 12,
		shadowColor: '#0F172A',
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
		color: '#2563EB',
	},
	title: {
		fontSize: 34,
		lineHeight: 40,
		fontWeight: '800',
		color: '#0F172A',
	},
	subtitle: {
		fontSize: 16,
		lineHeight: 24,
		color: '#475569',
		marginBottom: 8,
	},
	actions: {
		gap: 12,
		marginTop: 8,
	},
	primaryButton: {
		backgroundColor: '#2563EB',
		borderRadius: 14,
		paddingVertical: 16,
		alignItems: 'center',
	},
	primaryButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '700',
	},
	secondaryButton: {
		backgroundColor: '#E2E8F0',
		borderRadius: 14,
		paddingVertical: 16,
		alignItems: 'center',
	},
	secondaryButtonText: {
		color: '#0F172A',
		fontSize: 16,
		fontWeight: '700',
	},
});