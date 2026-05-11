"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let nextId = 1;
const listeners = new Set<(item: ToastItem) => void>();

export function showToast(message: string, type: ToastType = "info") {
  const item: ToastItem = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(item));
}

const TONE: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", icon: "OK" },
  error: { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", icon: "!" },
  info: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-800", icon: "i" },
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const handler = (item: ToastItem) => {
      setItems((prev) => [...prev.slice(-4), item]);
      const timer = setTimeout(() => dismiss(item.id), 4000);
      timers.current.set(item.id, timer);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [dismiss]);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2" aria-live="polite">
      {items.map((item) => {
        const tone = TONE[item.type];
        return (
          <div
            key={item.id}
            className={`animate-[slideUp_280ms_ease-out] flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${tone.bg} ${tone.border}`}
          >
            <span className={`text-base font-bold ${tone.text}`}>{tone.icon}</span>
            <span className={`text-sm font-medium ${tone.text}`}>{item.message}</span>
            <button
              type="button"
              className={`ml-2 text-xs font-semibold opacity-60 hover:opacity-100 ${tone.text}`}
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
