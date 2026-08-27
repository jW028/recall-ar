import { Stack } from 'expo-router';

// Drill-down stack so sub-routes (index -> [id]) have a proper stack history
export default function ContextAlertsLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
