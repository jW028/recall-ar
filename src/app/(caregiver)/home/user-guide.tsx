import { FaqAccordion } from '@/components/common/FaqAccordion';
import { USER_GUIDE_FAQ } from '@/constants/infoContent';

export default function UserGuideScreen() {
    return <FaqAccordion items={USER_GUIDE_FAQ} />;
}
