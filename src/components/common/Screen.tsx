import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
    children: ReactNode;
    // Apply top safe-area padding (use when the screen has no ScreenHeader)
    topInset?: boolean;
    background?: 'surface' | 'page';
    style?: StyleProp<ViewStyle>;
}

// Themed full-height container that handles safe-area padding
export function Screen({ children, topInset, background = 'surface', style }: ScreenProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View
            style={[
                styles.container,
                background === 'page' && styles.page,
                topInset && { paddingTop: insets.top },
                style,
            ]}
        >
            {children}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.surface,
        },
        page: {
            backgroundColor: theme.pageBackground,
        },
    });
}
