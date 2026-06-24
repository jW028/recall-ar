import { Stack } from 'expo-router';

// Drill-down stack so the tab bar persists across detail screens
export default function TabStackLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
