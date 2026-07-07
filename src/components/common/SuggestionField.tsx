import { View } from 'react-native';
import { FormField } from '@/components/common/FormField';
import { SuggestionChips } from '@/components/common/SuggestionChips';

type Props = {
    suggestions: readonly string[];
    value: string;
    onChangeText: (value: string) => void;
} & Omit<React.ComponentProps<typeof FormField>, 'onChangeText'>;

// FormField with tap-to-fill suggestion chips above it; custom values remain allowed
export function SuggestionField({ suggestions, value, onChangeText, ...fieldProps }: Props) {
    return (
        <View>
            <SuggestionChips suggestions={suggestions} value={value} onSelect={onChangeText} />
            <FormField {...fieldProps} value={value} onChangeText={onChangeText} />
        </View>
    );
}
