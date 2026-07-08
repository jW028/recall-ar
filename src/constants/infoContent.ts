// Static copy for the caregiver Help & Legal screens
// NOTE: PRIVACY_DECLARATION and TERMS_CONDITIONS are draft templates — have them
// reviewed by legal/counsel before any public release.

export interface FaqItem {
    question: string;
    answer: string;
}

export interface InfoSection {
    heading: string;
    body: string;
}

export interface InfoArticleContent {
    title: string;
    updated: string;
    sections: InfoSection[];
}

// Kept in one place so the "Last updated" lines stay consistent
const LAST_UPDATED = 'July 2026';

// A leading note shown on the draft legal screens
const TEMPLATE_NOTE =
    'This is draft template text provided for development and has not been reviewed by legal counsel.';

export const USER_GUIDE_FAQ: FaqItem[] = [
    {
        question: 'How do I add a patient?',
        answer:
            'From the Home screen, open the patient card and tap Change, then Add patient (or tap Add patient on the welcome screen when you have none). Fill in their name, date of birth, emergency contact and any medical notes. You can manage multiple patients and switch between them at any time.',
    },
    {
        question: 'How do I enroll a memory?',
        answer:
            'Tap Enroll Memory on the Home screen or the + button in Memories. Choose whether it is a Person or an Object, add a name and a short description, then attach one or more clear photos. Good, well-lit photos from a few angles help the app recognise the person or object more reliably.',
    },
    {
        question: 'How does training work?',
        answer:
            'RecallAR uses spaced retrieval — the patient is asked to recall each enrolled person or object at gradually increasing intervals. Correct answers push the next review further out; misses bring it sooner. You can pause or resume training per memory from the Training tab, and each patient has a monthly active-review pool so sessions stay short.',
    },
    {
        question: 'How do I set up the patient’s device?',
        answer:
            'On the patient’s phone, open RecallAR and tap “Set up a patient device” on the sign-in screen. On your device, go to Home → Pair Device to show a QR code, and hold it up to the patient’s camera. The devices link once the code is scanned. The pairing code expires after a short time — generate a fresh one if it runs out.',
    },
    {
        question: 'How does location tracking and safe zones work?',
        answer:
            'When the patient’s device is paired and location permission is granted, it periodically shares its position while the app is open. On the Location tab you can see the latest position, add safe zones (geofences), and get a status of whether the patient is inside or has left a zone.',
    },
    {
        question: 'How do I read the analytics and export a report?',
        answer:
            'The Training tab’s Analytics view shows recognition accuracy and response-time trends over time, along with engagement summaries. Use Export Medical Report (also available as a Home quick action) to save a shareable report you can bring to a clinician. A report can only be generated once there is enough training data.',
    },
    {
        question: 'Does the app work offline?',
        answer:
            'Yes. RecallAR is offline-first — memories, training results and edits are saved on the device immediately and synced to the cloud automatically when a connection is available. Some actions that have no offline equivalent, such as generating a pairing code or uploading photos, need an internet connection.',
    },
    {
        question: 'How do I switch between patients?',
        answer:
            'Tap the patient card on the Home screen and choose Change, or use the Switch Patient quick action. The whole app — memories, training and location — follows the patient you currently have selected.',
    },
];

export const PRIVACY_DECLARATION: InfoArticleContent = {
    title: 'Privacy Declaration',
    updated: LAST_UPDATED,
    sections: [
        { heading: 'Draft', body: TEMPLATE_NOTE },
        {
            heading: 'What we collect',
            body: 'To provide the service we process account details you give us (name, email, contact), patient profiles you create (name, date of birth, emergency contact and medical notes), the photos and descriptions you enroll as memories, training results, and — where you enable it — the patient device’s approximate location.',
        },
        {
            heading: 'Photos and memory data',
            body: 'Photos you enroll are used to help the patient recognise the people and objects that matter to them. They are stored securely and are only accessible to your linked caregiver account and the paired patient device.',
        },
        {
            heading: 'Location data',
            body: 'Location is only collected from a paired patient device when location permission is granted, and is used to show recent position and safe-zone status. Only a limited history of recent points is retained. You can turn location off at any time in the device settings.',
        },
        {
            heading: 'Medical notes and health analytics',
            body: 'Medical notes and cognitive training analytics are sensitive information. They are used solely to support care and to produce the reports you choose to generate. They are never sold, and are never used for advertising.',
        },
        {
            heading: 'How your data is stored',
            body: 'Data is saved on your device for offline use and synced to our cloud backend (hosted on Supabase) over encrypted connections. Access is restricted to your account and its linked patient devices.',
        },
        {
            heading: 'Sharing',
            body: 'We do not sell your data. Information is shared only with the infrastructure providers needed to run the service, or when required by law. Reports you export are shared only by you, with whoever you choose.',
        },
        {
            heading: 'Retention and your choices',
            body: 'You can edit or delete patients, memories and account data from within the app. Deleting a record removes it from the device and requests its removal from the cloud on the next sync. You may request deletion of your account and associated data by contacting us.',
        },
        {
            heading: 'Contact',
            body: 'For any privacy question or request, contact the RecallAR team at privacy@recallar.example.',
        },
    ],
};

export const TERMS_CONDITIONS: InfoArticleContent = {
    title: 'Terms & Conditions',
    updated: LAST_UPDATED,
    sections: [
        { heading: 'Draft', body: TEMPLATE_NOTE },
        {
            heading: 'Acceptance of terms',
            body: 'By creating an account or using RecallAR you agree to these terms. If you do not agree, please do not use the app.',
        },
        {
            heading: 'Medical disclaimer',
            body: 'RecallAR is a supportive tool for caregivers and is not a medical device. It does not diagnose, treat or prevent any condition, and its analytics are not a substitute for professional medical advice. Always consult a qualified clinician for medical decisions.',
        },
        {
            heading: 'Acceptable use',
            body: 'You agree to use the app lawfully and only for the care of patients for whom you are an authorised caregiver. You must have the appropriate consent to enroll another person’s photos, information or location.',
        },
        {
            heading: 'Accounts and device pairing',
            body: 'You are responsible for keeping your account credentials secure and for devices you pair to a patient profile. You may unpair a patient device at any time from within the app.',
        },
        {
            heading: 'Your content',
            body: 'You retain ownership of the content you add, such as photos and notes. You grant us the limited permission needed to store, process and display that content in order to provide the service to you.',
        },
        {
            heading: 'Availability and liability',
            body: 'The service is provided on an “as is” basis. To the extent permitted by law, we are not liable for indirect or consequential loss arising from use of the app, including reliance on recognition results, reminders or location information.',
        },
        {
            heading: 'Changes to these terms',
            body: 'We may update these terms from time to time. Continued use of the app after an update means you accept the revised terms.',
        },
        {
            heading: 'Contact',
            body: 'Questions about these terms can be sent to the RecallAR team at support@recallar.example.)',
        },
    ],
};
