import * as React from 'react';
import type { DiffFile, DiffRow } from '../engine/types';
import { applySyntax, planSyntax } from './plan';
import { SYNTAX_REVEAL_MS } from './protocol';
import { diffSyntax } from './shared';
import type { SyntaxOutcome, SyntaxRequest, SyntaxService } from './service';

/** 0 = measurement/disabled, 1 = mounted ahead/prefetched, 2 = actually visible. */
export const DiffSyntaxPriority = React.createContext(2);
/** Allows the dev benchmark to compare against a genuinely syntax-free render. */
export const DiffSyntaxEnabled = React.createContext(true);

export function usePreparedSyntax(
    file: DiffFile,
    displayed: DiffRow[],
    priority: number,
    service: SyntaxService = diffSyntax,
): { rows: DiffRow[]; pending: boolean } {
    const plan = React.useMemo(() => priority === 0 ? [] : planSyntax(file, displayed), [file, displayed, priority === 0]);
    const cached = React.useMemo(() => {
        const outcomes = new Map<string, SyntaxOutcome>();
        for (const hunk of plan) {
            const hit = service.peek(hunk.key);
            if (hit) outcomes.set(hunk.key, hit);
        }
        return outcomes;
    }, [plan, service]);
    const [settled, setSettled] = React.useState<{ plan: typeof plan; outcomes: Map<string, SyntaxOutcome> } | null>(null);
    const pendingSince = React.useRef<number | null>(null);
    const revealed = React.useRef(false);
    const requests = React.useRef<SyntaxRequest[]>([]);
    const priorityRef = React.useRef(priority);
    priorityRef.current = priority;

    React.useEffect(() => {
        for (const request of requests.current) request.setPriority(priority);
    }, [priority]);

    React.useEffect(() => {
        service.recordCacheUse(cached.size);
        if (cached.size === plan.length) {
            pendingSince.current = null;
            return;
        }
        let alive = true;
        let finished = false;
        const start = pendingSince.current ?? performance.now();
        pendingSince.current = start;
        const outcomes = new Map(cached);
        const finish = () => {
            if (!alive || finished) return;
            finished = true;
            pendingSince.current = null;
            // Copy once: late responses must not recolor an already revealed
            // version or reset progressive mounting. They're cache-only.
            setSettled({ plan, outcomes: new Map(outcomes) });
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
                console.log(`[perf] diff syntax reveal wait=${(performance.now() - start).toFixed(1)}ms settled=${outcomes.size}/${plan.length}`);
            }
        };
        const remaining = Math.max(0, SYNTAX_REVEAL_MS - (performance.now() - start));
        const timer = setTimeout(finish, remaining);
        requests.current = plan.filter((hunk) => !cached.has(hunk.key)).map((hunk) => {
            const request = service.request(hunk.input, priorityRef.current, hunk.key);
            request.promise.then((outcome) => {
                if (!alive || finished) return;
                outcomes.set(hunk.key, outcome);
                if (outcomes.size === plan.length) finish();
            });
            return request;
        });
        // Once content has been painted, source updates and "show more" must
        // not blank it again. Prepare their syntax for a future visit instead.
        if (revealed.current) finish();
        return () => {
            alive = false;
            clearTimeout(timer);
            for (const request of requests.current) request.cancel();
            requests.current = [];
        };
    }, [plan, cached, service]);

    const outcomes = settled?.plan === plan ? settled.outcomes : cached;
    const pending = !revealed.current && plan.length > cached.size && settled?.plan !== plan;
    React.useLayoutEffect(() => { if (!pending && priority !== 0) revealed.current = true; }, [pending, priority]);
    const rows = React.useMemo(() => {
        if (!outcomes.size) return displayed;
        const start = performance.now();
        const result = applySyntax(displayed, plan, outcomes);
        const elapsed = performance.now() - start;
        if (elapsed > 2 || (typeof __DEV__ !== 'undefined' && __DEV__)) {
            console.log(`[perf] diff syntax apply=${elapsed.toFixed(1)}ms rows=${displayed.length}`);
        }
        return result;
    }, [displayed, plan, outcomes]);
    return { rows, pending };
}