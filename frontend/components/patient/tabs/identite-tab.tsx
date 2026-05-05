"use client";

import { IdentityEditCard } from "@/components/patient/identity-edit-card";
import type { Patient } from "@/lib/api/patients";

interface Props {
  patient: Patient;
}

export function IdentiteTab({ patient }: Props) {
  return (
    <div className="space-y-6">
      <IdentityEditCard patient={patient} />
    </div>
  );
}
