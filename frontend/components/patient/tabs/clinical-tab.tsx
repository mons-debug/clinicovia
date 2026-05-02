"use client";

import { ClinicalEditCard } from "@/components/patient/clinical-edit-card";
import type { Patient } from "@/lib/api/patients";

interface Props {
  patient: Patient;
}

export function ClinicalTab({ patient }: Props) {
  return (
    <div className="space-y-6">
      <ClinicalEditCard patient={patient} />
    </div>
  );
}
