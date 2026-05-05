"use client";

import { ScreeningCard } from "@/components/patient/screening-card";

interface Props {
  patientId: string;
}

export function ScreeningTab({ patientId }: Props) {
  return (
    <div className="space-y-6">
      <ScreeningCard patientId={patientId} />
    </div>
  );
}
