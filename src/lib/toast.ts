"use client";

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

type ToastOptions = { persist?: boolean };

const QUEUE_KEY = "v11-toast-queue";
const MAX = 4;
export const TOAST_EVENT = "v11:toast";
export const TOAST_DISMISS_EVENT = "v11:toast-dismiss";

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function persist(item: ToastItem) {
  try {
    const current = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]") as ToastItem[];
    const next = [...(Array.isArray(current) ? current : []), item].slice(-MAX);
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedToasts(): ToastItem[] {
  try {
    const current = JSON.parse(sessionStorage.getItem(QUEUE_KEY) || "[]") as ToastItem[];
    sessionStorage.removeItem(QUEUE_KEY);
    return Array.isArray(current) ? current : [];
  } catch {
    return [];
  }
}

function emit(item: ToastItem) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail: item, bubbles: true }));
}

function push(kind: ToastKind, message: string, options?: ToastOptions) {
  const text = message.trim();
  if (!text) return;
  const item: ToastItem = { id: makeId(), kind, message: text };
  if (options?.persist) persist(item);
  emit(item);
}

export function dismissToast(id: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_DISMISS_EVENT, { detail: { id } }));
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    push("success", message, options);
  },
  error(message: string, options?: ToastOptions) {
    push("error", message, options);
  },
  info(message: string, options?: ToastOptions) {
    push("info", message, options);
  },
};
