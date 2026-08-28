import NetInfo from '@react-native-community/netinfo';

// Cached rather than probed per call: sync cycles ask this once per table and once per queued row, and NetInfo.fetch() is an async round trip each time.
let online = true;
let subscribed = false;

// Subscribed lazily so importing this module has no side effects in tests or before the app mounts.
function ensureSubscribed(): void {
    if (subscribed) return;
    subscribed = true;
    NetInfo.addEventListener((state) => {
        // isInternetReachable is null while NetInfo is still probing after a reconnect; only a definite false means offline, otherwise the first cycle after airplane mode is skipped for no reason.
        online = Boolean(state.isConnected) && state.isInternetReachable !== false;
    });
}

// Best-effort connectivity check. Optimistic before the first NetInfo event arrives — a wrong "online" only costs one failed request, a wrong "offline" silently drops work.
export function isOnline(): boolean {
    ensureSubscribed();
    return online;
}

// True when PostgREST rejected a token that is otherwise valid but was minted a moment ahead of the API node's clock (PGRST303). It validates `iat`/`nbf` with no skew tolerance, so a token used right after it is issued can arrive before the server clock reaches that instant. The same token works seconds later.
export function isClockSkewAuthError(message: string | null | undefined): boolean {
    if (!message) return false;
    return /jwt issued at future|jwt not yet valid/i.test(message);
}

// Failures the next cycle will retry unchanged, so they must not be logged as app errors or burn the rest of the batch on requests that would fail identically.
export function isRetryableSyncError(message: string | null | undefined): boolean {
    return isTransientNetworkError(message) || isClockSkewAuthError(message);
}

// True for a transport-level failure (airplane mode, dropped wifi, DNS) as opposed to a rejection Supabase actually returned. These are expected while offline: they must not be logged as app errors, and retrying the rest of a batch through the same dead connection is pointless.
export function isTransientNetworkError(message: string | null | undefined): boolean {
    if (!message) return false;
    return /network request failed|failed to fetch|network error|load failed|timed? ?out/i.test(message);
}
