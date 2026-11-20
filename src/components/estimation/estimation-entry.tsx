"use client";

import { useEffect, useState } from "react";
import { EstimationSheet } from "@/components/estimation/estimation-sheet";
import { ManagerEstimationSheet } from "@/components/estimation/manager-estimation-sheet";

export function EstimationEntry() {
  const [role, setRole] = useState<string | null>(null);
  const [estimateId, setEstimateId] = useState("EST-2026-001");
  const [version, setVersion] = useState("v1");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { user?: { role?: string; estimateId?: string; version?: string } } | null) => {
        if (!active) return;
        setRole(payload?.user?.role ?? "Representative");
        if (payload?.user?.estimateId) setEstimateId(payload.user.estimateId);
        if (payload?.user?.version) setVersion(payload.user.version);
      })
      .catch(() => {
        if (active) setRole("Representative");
      });
    return () => {
      active = false;
    };
  }, []);

  if (!role) return <h1 className="text-page-title">Estimation sheet</h1>;
  if (role === "Line Manager") return <ManagerEstimationSheet estimateId={estimateId} />;
  return <EstimationSheet estimateId={estimateId} version={version} />;
}
