import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export const SCREENING_FLAGS = [
  "pregnancy_or_breastfeeding",
  "drug_allergies",
  "blood_thinners",
  "autoimmune_disease",
  "uncontrolled_diabetes",
  "active_cancer",
  "local_skin_infection",
  "active_herpes",
  "bleeding_disorder",
  "keloid_scarring",
  "uncontrolled_hypertension",
  "thyroid_disease",
  "implants_or_devices",
  "tattoo_or_pigment_in_zone",
  "prior_injectables",
  "recent_isotretinoin",
  "recent_sun_exposure",
  "herbal_supplements",
  "body_dysmorphia_concern",
] as const;

export type ScreeningFlag = (typeof SCREENING_FLAGS)[number];

export const FLAG_LABEL_FR: Record<ScreeningFlag, string> = {
  pregnancy_or_breastfeeding: "Grossesse ou allaitement",
  drug_allergies: "Allergies médicamenteuses",
  blood_thinners: "Anticoagulants / antiagrégants",
  autoimmune_disease: "Maladie auto-immune",
  uncontrolled_diabetes: "Diabète mal équilibré",
  active_cancer: "Cancer en traitement",
  local_skin_infection: "Infection cutanée locale",
  active_herpes: "Herpès actif",
  bleeding_disorder: "Trouble de la coagulation",
  keloid_scarring: "Tendance aux chéloïdes",
  uncontrolled_hypertension: "Hypertension non contrôlée",
  thyroid_disease: "Maladie thyroïdienne",
  implants_or_devices: "Implants / matériel médical",
  tattoo_or_pigment_in_zone: "Tatouage / pigment dans la zone",
  prior_injectables: "Antécédents Botox / fillers",
  recent_isotretinoin: "Roaccutane (< 6 mois)",
  recent_sun_exposure: "Exposition solaire récente",
  herbal_supplements: "Compléments / phytothérapie",
  body_dysmorphia_concern: "Trouble dysmorphique suspecté",
};

export type ScreeningPayload = Partial<Record<ScreeningFlag, boolean | null>> & {
  notes?: string | null;
};

export interface ScreeningResponse extends ScreeningPayload {
  id: string;
  patient_id: string;
  assessed_by: string | null;
  assessed_at: string | null;
  flag_count: number;
  answered_count: number;
}

export function usePatientScreening(patientId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["screening", patientId],
    queryFn: () =>
      apiClient<ScreeningResponse | null>(`/patients/${patientId}/screening`, {
        token: token ?? undefined,
      }),
    enabled: !!patientId,
  });
}

export function useUpsertScreening(patientId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ScreeningPayload) =>
      apiClient<ScreeningResponse>(`/patients/${patientId}/screening`, {
        method: "PUT",
        body: JSON.stringify(data),
        token: token ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screening", patientId] });
    },
  });
}
