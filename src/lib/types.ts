export type SessionUser = {
  email: string;
  role: string;
  estimateId: string;
  version: string;
};

export type EstimateStatus = "pending" | "approved" | "rejected";

export type EstimateRecord = {
  id: string;
  title: string;
  mode: string;
  status: EstimateStatus;
  createdAt: string;
};

export type StatTone = "purple" | "orange" | "green" | "red";

export type DashboardStat = {
  key: string;
  label: string;
  value: number;
  tone: StatTone;
};

export type DashboardSummary = {
  steps: readonly string[];
  progress: number;
  stats: DashboardStat[];
};
