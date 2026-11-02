'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { locateCurrentPlace, LocationError } from '../lib/location';
import type { LocationFix, LocationProblem } from '../lib/location';
export function useFarmLocation(onLocated: (fix: LocationFix) => void, autoLocate = true) {
    const [status, setStatus] = useState<'idle' | 'finding' | 'ready' | LocationProblem>(autoLocate ? 'finding' : 'idle');
    const [position, setPosition] = useState<LocationFix | null>(null);
    const started = useRef(false), mounted = useRef(false), generation = useRef(0), callback = useRef(onLocated);
    callback.current = onLocated;
    const locate = useCallback(async () => {
        const id = ++generation.current;
        setStatus('finding');
        try {
            const fix = await locateCurrentPlace(navigator.geolocation);
            if (!mounted.current || id !== generation.current)
                return;
            setPosition(fix);
            setStatus('ready');
            callback.current(fix);
        }
        catch (error) {
            if (mounted.current && id === generation.current)
                setStatus(error instanceof LocationError ? error.code : 'unavailable');
        }
    }, []);
    useEffect(() => {
        mounted.current = true;
        if (autoLocate && !started.current) {
            started.current = true;
            void locate();
        }
        return () => { mounted.current = false; };
    }, [locate, autoLocate]);
    return { status, position, locate };
}
