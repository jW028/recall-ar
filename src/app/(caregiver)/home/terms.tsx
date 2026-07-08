import { InfoArticle } from '@/components/common/InfoArticle';
import { TERMS_CONDITIONS } from '@/constants/infoContent';

export default function TermsScreen() {
    return <InfoArticle {...TERMS_CONDITIONS} />;
}
