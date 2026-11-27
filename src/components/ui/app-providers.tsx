"use client";

import type { ReactNode } from "react";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Toaster } from "@/components/ui/toaster";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
      <RegisterServiceWorker />
    </>
  );
}
