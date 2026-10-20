'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const CONSENT_KEY = 'jfit-marketing-cookies';
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();

type MetaPixelFunction = ((...args: Array<string | number>) => void) & {
  queue: Array<Array<string | number>>;
  callMethod?: (...args: Array<string | number>) => void;
  version: string;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
  }
}

type Consent = 'accepted' | 'rejected' | null;

export default function MetaPixel() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [showBanner, setShowBanner] = useState(false);
  const isPrivatePage = pathname === '/account' || pathname.startsWith('/account/') || pathname === '/admin' || pathname.startsWith('/admin/');

  useEffect(() => {
    const saved = window.localStorage.getItem(CONSENT_KEY);
    if (saved === 'accepted' || saved === 'rejected') {
      setConsent(saved);
    } else {
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    if (!pixelId || consent !== 'accepted' || isPrivatePage) return;

    if (!window.fbq) {
      const fbq: MetaPixelFunction = Object.assign((...args: Array<string | number>) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      }, {
        queue: [] as Array<Array<string | number>>,
        version: '2.0',
      });
      window.fbq = fbq;
      window._fbq = window.fbq;

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.id = 'jfit-meta-pixel-script';
      document.head.appendChild(script);
      window.fbq('init', pixelId);
    }

    window.fbq('consent', 'grant');
    window.fbq('track', 'PageView');
  }, [consent, isPrivatePage, pathname]);

  if (!pixelId) return null;

  function saveConsent(next: Exclude<Consent, null>) {
    window.localStorage.setItem(CONSENT_KEY, next);
    setConsent(next);
    setShowBanner(false);
    if (next === 'rejected') window.fbq?.('consent', 'revoke');
  }

  return <>
    {showBanner && <aside className="cookie-banner" aria-label="Cookie preferences">
      <div><strong>Cookies that help Jfit grow</strong><p>With your permission, we use Meta Pixel to understand how people find and use Jfit. You can change this choice at any time.</p></div>
      <div className="cookie-actions">
        <button type="button" onClick={() => saveConsent('rejected')}>Reject optional</button>
        <button type="button" className="cookie-accept" onClick={() => saveConsent('accepted')}>Allow analytics</button>
      </div>
    </aside>}
    {!showBanner && <button className="privacy-settings" type="button" onClick={() => setShowBanner(true)}>Cookie settings</button>}
  </>;
}
