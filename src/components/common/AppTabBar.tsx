import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom themed bottom tab bar shared by patient and caregiver navigators
export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                // Skip routes that opt out of the tab bar (e.g. redirect-only index)
                if (!options.tabBarIcon) return null;
                const label = options.title ?? route.name;
                const isFocused = state.index === index;
                const color = isFocused ? theme.primary : theme.textMuted;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });
                    if (!isFocused && !event.defaultPrevented) {
                        // Dynamic route name; navigate typing can't infer it here
                        (navigation.navigate as (name: string, params?: object) => void)(
                            route.name,
                            route.params
                        );
                    }
                };

                return (
                    <Pressable
                        key={route.key}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={label}
                        onPress={onPress}
                        style={styles.tab}
                    >
                        {options.tabBarIcon?.({ focused: isFocused, color, size: 26 })}
                        <Text style={[styles.label, { color }]} numberOfLines={1}>
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        bar: {
            flexDirection: 'row',
            backgroundColor: theme.surface,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: theme.border,
            paddingTop: 10,
        },
        tab: {
            flex: 1,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
        },
        label: {
            fontSize: 11,
            fontWeight: '600',
        },
    });
}
