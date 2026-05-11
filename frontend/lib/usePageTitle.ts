"use client";

import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    const base = "Smart Syllabus Studio";
    document.title = title ? `${title} - ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [title]);
}
