import { Stack } from 'expo-router';

// Drill-down stack so the tab bar persists across the ticket list and thread
export default function SupportLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
