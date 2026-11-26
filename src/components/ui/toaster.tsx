"use client";

import { useEffect } from "react";
import {
  readPersistedToasts,
  setToastPainter,
  type ToastItem,
  type ToastKind,
} from "@/lib/toast";

const MAX = 4;
const HOST_CLASS =
  "pointer-events-none fixed top-4 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2.5 max-[47.5rem]:top-auto max-[47.5rem]:right-1/2 max-[47.5rem]:bottom-4 max-[47.5rem]:translate-x-1/2";
const CARD_CLASS = {
  success:
    "pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#b7ead8] bg-[#f4fcf8] px-3.5 py-3.5 shadow-[var(--shadow-card)]",
  error:
    "pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#f4c7c3] bg-[#fff6f5] px-3.5 py-3.5 shadow-[var(--shadow-card)]",
  info:
    "pointer-events-auto flex items-start gap-3 rounded-2xl border border-[#d4dcff] bg-[#f5f7ff] px-3.5 py-3.5 shadow-[var(--shadow-card)]",
} as const;
const MESSAGE_CLASS = "m-0 flex-1 text-[0.9375rem] font-medium leading-[1.4] text-[var(--ink)]";
const DISMISS_CLASS =
  "hover:bg-black/5 -mr-1 -mt-0.5 size-6 shrink-0 rounded-lg border-0 bg-transparent text-xl leading-none text-[var(--ink-soft)]";

function duration(kind: ToastKind) {
  return kind === "error" ? 5600 : 4200;
}

function iconSvg(kind: ToastKind) {
  if (kind === "error") {
    return '<svg class="mt-0.5 size-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden><circle cx="10" cy="10" r="8" fill="#d92d20"/><path d="M10 6.2v4.6M10 13.7h.01" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  if (kind === "info") {
    return '<svg class="mt-0.5 size-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden><circle cx="10" cy="10" r="8" fill="#2f4bff"/><path d="M10 9v4.4M10 6.4h.01" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  return '<svg class="mt-0.5 size-5 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden><circle cx="10" cy="10" r="8" fill="#0b7a5c"/><path d="M6.6 10.2 8.8 12.4 13.4 7.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function showToast(host: HTMLElement, item: ToastItem) {
  while (host.childElementCount >= MAX) host.firstElementChild?.remove();

  const card = document.createElement("div");
  card.className = CARD_CLASS[item.kind] ?? CARD_CLASS.info;
  card.setAttribute("role", item.kind === "error" ? "alert" : "status");
  card.dataset.toastId = item.id;
  card.innerHTML = iconSvg(item.kind);

  const message = document.createElement("p");
  message.className = MESSAGE_CLASS;
  message.textContent = item.message;
  card.append(message);

  const close = document.createElement("button");
  close.type = "button";
  close.className = DISMISS_CLASS;
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";
  card.append(close);

  const timeout = window.setTimeout(() => card.remove(), duration(item.kind));
  close.addEventListener("click", () => {
    window.clearTimeout(timeout);
    card.remove();
  });

  host.append(card);
}

export function Toaster() {
  useEffect(() => {
    const host = document.querySelector("[data-toast-host]");
    if (!(host instanceof HTMLElement)) return;

    function onToast(event: Event) {
      const item = (event as CustomEvent<ToastItem>).detail;
      if (item?.message && host instanceof HTMLElement) showToast(host, item);
    }

    function onDismiss(event: Event) {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (!id || !(host instanceof HTMLElement)) return;
      host.querySelector(`[data-toast-id="${id}"]`)?.remove();
    }

    setToastPainter((item) => showToast(host, item));
    window.addEventListener("v11:toast", onToast);
    document.addEventListener("v11:toast", onToast);
    window.addEventListener("v11:toast-dismiss", onDismiss);
    for (const item of readPersistedToasts()) showToast(host, item);

    return () => {
      setToastPainter(null);
      window.removeEventListener("v11:toast", onToast);
      document.removeEventListener("v11:toast", onToast);
      window.removeEventListener("v11:toast-dismiss", onDismiss);
    };
  }, []);

  return <div className={HOST_CLASS} data-toast-host="true" aria-live="polite" aria-relevant="additions text" />;
}
