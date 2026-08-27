import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { invokeAdminAction } from './adminApi';
import type { AdminAction } from './adminApi';

// Every mutation goes through the edge function and then invalidates the whole cache: an erasure
// cascades across tables, so there is no honest way to patch a single query result afterwards.
export function useAdminAction() {
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    async function run(
        action: AdminAction,
        targetId?: string,
        describe?: (result: Record<string, unknown>) => string,
        payload?: Record<string, unknown>
    ) {
        setBusy(action);
        setError(null);
        setNotice(null);
        try {
            const result = await invokeAdminAction(action, targetId, payload);
            setNotice(describe ? describe(result) : 'Done.');
            await queryClient.invalidateQueries();
            return result;
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            return null;
        } finally {
            setBusy(null);
        }
    }

    return { run, busy, error, notice };
}
