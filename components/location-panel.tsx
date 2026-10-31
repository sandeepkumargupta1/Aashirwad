'use client';
import { translate } from '../lib/i18n';
import { MapPin, LocateFixed, Map, Loader2, Check, Navigation, ArrowRight } from 'lucide-react';
import type { FieldLocation, LocationFix, LocationProblem } from '../lib/location';
export default function LocationPanel({ status, position, selected, onCurrent, onMap, hindi = false }: {
    status: 'finding' | 'ready' | LocationProblem;
    position: LocationFix | null;
    selected: FieldLocation | null;
    onCurrent: () => void;
    onMap: () => void;
    hindi?: boolean;
}) {
    const t = (en: string | null | undefined, hi?: string) => translate(en, hindi, hi);
    const finding = status === 'finding';
    const title = selected ? (selected.origin === 'gps' ? t('Your current area is selected', 'आपका वर्तमान क्षेत्र चुना गया है') : t('Your field is selected', 'आपका खेत चुन लिया गया है')) : finding ? t('Finding your current location…', 'आपकी वर्तमान जगह खोज रहे हैं…') : status === 'denied' ? t('Location access is off', 'लोकेशन की अनुमति बंद है') : status === 'outside' ? t('Choose a field in India', 'भारत में अपना खेत चुनें') : t('Let’s find your field', 'अपना खेत खोजें');
    const message = selected ? selected.label : finding ? t('Allow location in your browser. We’ll center the map for you.', 'ब्राउज़र में लोकेशन की अनुमति दें। नक्शा आपकी जगह पर खुलेगा।') : status === 'denied' ? t('Allow location in browser settings, or choose a place on the map.', 'ब्राउज़र सेटिंग में लोकेशन चालू करें या नक्शे पर जगह चुनें।') : status === 'outside' ? t('This version supports farms in India. You can search or choose on the map.', 'यह संस्करण भारत के खेतों के लिए है। नक्शे पर खोजें या चुनें।') : status === 'timeout' ? t('Your location took too long. Try again or choose on the map.', 'जगह खोजने में समय लगा। फिर कोशिश करें या नक्शे पर चुनें।') : t('Use your device location, or search for a village and tap your field.', 'अपनी वर्तमान जगह लें या गाँव खोजकर खेत पर टैप करें।');
    return <section className={`location-panel ${selected ? 'located' : ''}`} aria-label={t('Find your field', 'अपना खेत खोजें')}>
  <div className="location-panel-copy"><span className="location-main-icon">{finding && !selected ? <Loader2 className="spin" size={30}/> : selected ? <MapPin size={30}/> : <Navigation size={30}/>}</span><div><span className="location-eyebrow">{selected ? <><Check size={13}/>{t('LOCATION READY', 'जगह मिल गई')}</> : t('START HERE', 'यहाँ से शुरू करें')}</span><h2>{t(title)}</h2><p>{t(message)}</p>{position && selected?.origin === 'gps' && <small>{t('Device location', 'डिवाइस की जगह')}{t(position.accuracy > 0 ? ` · ${t('approximately', 'लगभग')} ${Math.round(position.accuracy).toLocaleString('en-IN')} m ${t('accuracy', 'सटीकता')}` : '')}. {t('Tap the map if your field is nearby.', 'खेत पास में हो तो नक्शे पर टैप करें।')}</small>}</div></div>
  <div className="location-actions"><button className="location-action current" onClick={onCurrent} disabled={finding}><span>{finding ? <Loader2 className="spin" size={25}/> : <LocateFixed size={27}/>}</span><div><strong>{t(finding ? t('Finding location…', 'जगह खोज रहे हैं…') : t('Use my current location', 'मेरी वर्तमान जगह लें'))}</strong><small>{t('Automatic · no address needed', 'अपने आप · पता लिखना नहीं पड़ेगा')}</small></div><ArrowRight size={17}/></button><button className="location-action nearby" onClick={onMap}><span><Map size={27}/></span><div><strong>{t(position ? t('Choose a nearby field', 'पास का खेत चुनें') : t('Choose a place on the map', 'नक्शे पर जगह चुनें'))}</strong><small>{t(position ? t('Map opens around your location', 'नक्शा आपके आस-पास खुलेगा') : t('Search a village or tap a field', 'गाँव खोजें या खेत पर टैप करें'))}</small></div><ArrowRight size={17}/></button></div>
  <p className="location-permission-note">{t('Your browser asks permission once. You can also use the map without location access.', 'आपका ब्राउज़र अनुमति माँगेगा। अनुमति दिए बिना भी नक्शा इस्तेमाल कर सकते हैं।')}</p>
 </section>;
}
