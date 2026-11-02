"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useLocale } from "./locale";

export default function GrowthScene() {
    const { t } = useLocale();
    const player = useRef<HTMLVideoElement>(null);
    const [paused, setPaused] = useState(true);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(24);
    const [showEnd, setShowEnd] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const video = player.current;
        if (!video) return;
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => {
            if (preference.matches) {
                video.pause();
                setShowEnd(true);
            } else {
                setShowEnd(false);
                void video.play().catch(() => setPaused(true));
            }
        };
        update();
        preference.addEventListener("change", update);
        return () => { preference.removeEventListener("change", update); video.pause(); };
    }, []);

    const play = (restart = false) => {
        const video = player.current;
        if (!video || failed) return;
        if (restart || video.ended || showEnd) {
            video.currentTime = 0;
            setTime(0);
        }
        void video.play().then(() => setShowEnd(false)).catch(() => setPaused(true));
    };
    const progress = showEnd ? 1 : Math.min(1, time / duration);
    const stage = showEnd ? 3 : time < 3.5 ? 0 : time < 8 ? 1 : time < 17 ? 2 : 3;

    return <div className={`photo-story photo-story--video${paused ? " paused" : ""}`} data-stage={stage} data-scene-time={time}>
        <div className="photo-canvas">
            <div className="photo-inner">
                <video ref={player} id="welcome-video" width="1280" height="720" muted playsInline preload="auto"
                    poster="/welcome/video-start.webp"
                    aria-label={t("A farmer prays, catches a drop, waters a seed, and watches a leafy plant grow.")}
                    onLoadedMetadata={event => {
                        const value = event.currentTarget.duration;
                        if (Number.isFinite(value) && value > 0) setDuration(value);
                    }}
                    onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
                    onPlay={() => { setPaused(false); setShowEnd(false); }}
                    onPause={() => setPaused(true)}
                    onEnded={() => { setPaused(true); setShowEnd(true); }}
                    onError={() => { setFailed(true); setPaused(true); setShowEnd(true); }}>
                    <source src="/welcome/aashirwad-welcome.mp4" type="video/mp4" />
                </video>
                {showEnd && <img src="/welcome/video-end.webp" width="1280" height="720" alt="" aria-hidden="true" draggable={false} />}
                <div className="photo-scene-label" aria-hidden="true"><span>{t("A wish for rain")}</span><span>{t("A drop of care")}</span><span>{t("Watering the seed")}</span><span>{t("A new beginning")}</span></div>
            </div>
        </div>
        <div className="photo-controls">
            <span className="photo-illustration-note">{t("AI-generated farm film")}</span>
            <div className="photo-progress" aria-hidden="true"><span className="photo-progress-fill" style={{ transform: `scaleX(${progress})` }} /></div>
            <button type="button" aria-controls="welcome-video" disabled={failed} aria-label={t(paused ? "Play animation" : "Pause animation")} aria-pressed={!paused} onClick={() => paused ? play() : player.current?.pause()}>{paused ? <Play size={13}/> : <Pause size={13}/>}<span>{t(paused ? "Play" : "Pause")}</span></button>
            <button type="button" aria-controls="welcome-video" disabled={failed} aria-label={t("Replay animation")} onClick={() => play(true)}><RotateCcw size={13}/><span>{t("Replay")}</span></button>
        </div>
        {failed && <p className="farm-video-error" role="status">{t("The farm video could not load. Please refresh to try again.")}</p>}
    </div>;
}
