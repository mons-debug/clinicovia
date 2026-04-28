"use client";

import { useEffect } from "react";

interface PixelConfig {
  meta_pixel_id?: string;
  google_ads_conversion_id?: string;
  google_ads_conversion_label?: string;
  ga4_measurement_id?: string;
  gtm_container_id?: string;
  snapchat_pixel_id?: string;
  tiktok_pixel_id?: string;
}

interface PixelScriptsProps {
  pixels: PixelConfig;
}

function injectScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function injectInlineScript(id: string, code: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.textContent = code;
  document.head.appendChild(script);
}

export function PixelScripts({ pixels }: PixelScriptsProps) {
  useEffect(() => {
    // Meta Pixel
    if (pixels.meta_pixel_id) {
      injectInlineScript(
        "clinicfy-meta-pixel",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixels.meta_pixel_id}');fbq('track','PageView');`,
      );
    }

    // GA4 / gtag.js
    if (pixels.ga4_measurement_id) {
      injectScript("clinicfy-gtag-js", `https://www.googletagmanager.com/gtag/js?id=${pixels.ga4_measurement_id}`);
      injectInlineScript(
        "clinicfy-gtag-config",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${pixels.ga4_measurement_id}');`,
      );
    }

    // Google Ads gtag (uses same gtag.js — just add config)
    if (pixels.google_ads_conversion_id) {
      // Load gtag.js if GA4 didn't already load it
      if (!pixels.ga4_measurement_id) {
        injectScript("clinicfy-gtag-js", `https://www.googletagmanager.com/gtag/js?id=${pixels.google_ads_conversion_id}`);
        injectInlineScript(
          "clinicfy-gtag-config",
          `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());`,
        );
      }
      injectInlineScript(
        "clinicfy-gads-config",
        `gtag('config','${pixels.google_ads_conversion_id}');`,
      );
    }

    // Google Tag Manager
    if (pixels.gtm_container_id) {
      injectInlineScript(
        "clinicfy-gtm",
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${pixels.gtm_container_id}');`,
      );
    }

    // Snapchat Pixel
    if (pixels.snapchat_pixel_id) {
      injectInlineScript(
        "clinicfy-snap-pixel",
        `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${pixels.snapchat_pixel_id}');snaptr('track','PAGE_VIEW');`,
      );
    }

    // TikTok Pixel
    if (pixels.tiktok_pixel_id) {
      injectInlineScript(
        "clinicfy-tiktok-pixel",
        `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e+""]=+new Date;ttq._o=ttq._o||{};ttq._o[e+""]=n||{};var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src=r+"?sdkid="+e+"&lib="+t;var i=document.getElementsByTagName("script")[0];i.parentNode.insertBefore(a,i)};ttq.load('${pixels.tiktok_pixel_id}');ttq.page();}(window,document,'ttq');`,
      );
    }
  }, [pixels]);

  return null;
}

/**
 * Fire conversion events on all configured client-side pixels.
 * Call this on form submission or other conversion actions.
 */
export function fireClientConversion(pixels: PixelConfig, eventData?: { value?: number; currency?: string }) {
  if (typeof window === "undefined") return;

  // Meta Pixel
  if (pixels.meta_pixel_id && (window as any).fbq) {
    (window as any).fbq("track", "Lead", eventData ? { value: eventData.value, currency: eventData.currency } : undefined);
  }

  // Google Ads Conversion
  if (pixels.google_ads_conversion_id && pixels.google_ads_conversion_label && (window as any).gtag) {
    (window as any).gtag("event", "conversion", {
      send_to: `${pixels.google_ads_conversion_id}/${pixels.google_ads_conversion_label}`,
      ...(eventData?.value && { value: eventData.value, currency: eventData.currency || "AED" }),
    });
  }

  // GA4
  if (pixels.ga4_measurement_id && (window as any).gtag) {
    (window as any).gtag("event", "generate_lead", eventData ? { value: eventData.value, currency: eventData.currency } : undefined);
  }

  // Snapchat
  if (pixels.snapchat_pixel_id && (window as any).snaptr) {
    (window as any).snaptr("track", "SIGN_UP");
  }

  // TikTok
  if (pixels.tiktok_pixel_id && (window as any).ttq) {
    (window as any).ttq.track("SubmitForm");
  }
}
