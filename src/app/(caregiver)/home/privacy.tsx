import { InfoArticle } from '@/components/common/InfoArticle';
import { PRIVACY_DECLARATION } from '@/constants/infoContent';

export default function PrivacyScreen() {
    return <InfoArticle {...PRIVACY_DECLARATION} />;
}
