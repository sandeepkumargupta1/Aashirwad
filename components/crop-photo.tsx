"use client";
import { useEffect, useState } from "react";
import { Sprout } from "lucide-react";
import photos from "../data/crop-photos.json";
import { useLocale } from "./locale";

export default function CropPhoto({ id, large = false }: { id: string; large?: boolean }) {
    const { t } = useLocale();
    const [failed, setFailed] = useState(false);
    const photo = photos[id as keyof typeof photos];
    useEffect(() => setFailed(false), [id]);
    return <span className={`crop-photo photo-${id} ${large ? "large" : ""}`}>
        {photo && !failed ? <img src={photo.src} alt={t(photo.alt)} width={photo.width} height={photo.height} loading={large ? "eager" : "lazy"} decoding="async" style={{ objectPosition: photo.position }} onError={() => setFailed(true)}/>
            : <span className="crop-photo-fallback" role="img" aria-label={t("Crop photo unavailable")}><Sprout size={28}/><span>{t("Photo not available")}</span></span>}
    </span>;
}
