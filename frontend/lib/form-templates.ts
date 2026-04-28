import type { FormSchema } from "@/lib/api/forms";

export interface FormTemplate {
  name: string;
  description: string;
  category: string;
  schema: FormSchema;
}

const defaultSettings = {
  submitButtonText: "Submit",
  submitButtonColor: "#3EC8A0",
  successMessage: "Thank you for your submission! We will get back to you shortly.",
  redirectUrl: null,
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    name: "Patient Intake",
    description: "Collect essential patient information before their first visit",
    category: "Intake",
    schema: {
      fields: [
        { id: "f1", type: "text", label: "Full Name", placeholder: "Enter your full name", helpText: "", required: true, validation: { minLength: 2, maxLength: 100 }, options: [], order: 0 },
        { id: "f2", type: "phone", label: "Phone Number", placeholder: "50 123 4567", helpText: "We will use this to contact you", required: true, validation: {}, options: [], order: 1 },
        { id: "f3", type: "email", label: "Email Address", placeholder: "your@email.com", helpText: "", required: false, validation: {}, options: [], order: 2 },
        { id: "f4", type: "date", label: "Date of Birth", placeholder: "", helpText: "", required: true, validation: {}, options: [], order: 3 },
        { id: "f5", type: "radio", label: "Gender", placeholder: "", helpText: "", required: true, validation: {}, options: [{ label: "Male", value: "male" }, { label: "Female", value: "female" }], order: 4 },
        { id: "f6", type: "select", label: "Treatment Interest", placeholder: "Select treatment", helpText: "", required: false, validation: {}, options: [{ label: "Botox", value: "botox" }, { label: "Fillers", value: "fillers" }, { label: "Laser", value: "laser" }, { label: "Hair Transplant", value: "hair_transplant" }, { label: "Dental", value: "dental" }, { label: "Other", value: "other" }], order: 5 },
        { id: "f7", type: "textarea", label: "Medical History", placeholder: "Any allergies, medications, or conditions...", helpText: "This information helps our doctors prepare for your visit", required: false, validation: { maxLength: 1000 }, options: [], order: 6 },
        { id: "f8", type: "checkbox", label: "I consent to the processing of my personal data", placeholder: "", helpText: "", required: true, validation: {}, options: [], order: 7 },
      ],
      settings: { ...defaultSettings, submitButtonText: "Submit Intake Form" },
    },
  },
  {
    name: "Consultation Request",
    description: "Allow patients to request a consultation appointment",
    category: "Booking",
    schema: {
      fields: [
        { id: "f1", type: "text", label: "Full Name", placeholder: "Enter your full name", helpText: "", required: true, validation: { minLength: 2 }, options: [], order: 0 },
        { id: "f2", type: "phone", label: "Phone Number", placeholder: "50 123 4567", helpText: "", required: true, validation: {}, options: [], order: 1 },
        { id: "f3", type: "email", label: "Email", placeholder: "your@email.com", helpText: "", required: false, validation: {}, options: [], order: 2 },
        { id: "f4", type: "select", label: "Treatment of Interest", placeholder: "Select...", helpText: "", required: true, validation: {}, options: [{ label: "Botox", value: "botox" }, { label: "Fillers", value: "fillers" }, { label: "Laser Treatment", value: "laser" }, { label: "Hair Transplant", value: "hair" }, { label: "Skin Care", value: "skin" }, { label: "Consultation Only", value: "consultation" }], order: 3 },
        { id: "f5", type: "select", label: "Preferred Time", placeholder: "Select...", helpText: "", required: false, validation: {}, options: [{ label: "Morning (9-12)", value: "morning" }, { label: "Afternoon (12-5)", value: "afternoon" }, { label: "Evening (5-8)", value: "evening" }], order: 4 },
        { id: "f6", type: "textarea", label: "Additional Notes", placeholder: "Tell us more about what you need...", helpText: "", required: false, validation: { maxLength: 500 }, options: [], order: 5 },
      ],
      settings: { ...defaultSettings, submitButtonText: "Request Consultation" },
    },
  },
  {
    name: "Treatment Feedback",
    description: "Collect patient feedback after treatment",
    category: "Feedback",
    schema: {
      fields: [
        { id: "f1", type: "text", label: "Your Name", placeholder: "Enter your name", helpText: "", required: true, validation: {}, options: [], order: 0 },
        { id: "f2", type: "phone", label: "Phone Number", placeholder: "50 123 4567", helpText: "", required: true, validation: {}, options: [], order: 1 },
        { id: "f3", type: "radio", label: "Overall Experience", placeholder: "", helpText: "Rate your overall experience", required: true, validation: {}, options: [{ label: "Excellent", value: "5" }, { label: "Good", value: "4" }, { label: "Average", value: "3" }, { label: "Below Average", value: "2" }, { label: "Poor", value: "1" }], order: 2 },
        { id: "f4", type: "radio", label: "Would you recommend us?", placeholder: "", helpText: "", required: true, validation: {}, options: [{ label: "Yes, definitely", value: "yes" }, { label: "Maybe", value: "maybe" }, { label: "No", value: "no" }], order: 3 },
        { id: "f5", type: "textarea", label: "Comments", placeholder: "Tell us what we did well or how we can improve...", helpText: "", required: false, validation: { maxLength: 1000 }, options: [], order: 4 },
      ],
      settings: { ...defaultSettings, submitButtonText: "Submit Feedback", successMessage: "Thank you for your feedback! It helps us serve you better." },
    },
  },
  {
    name: "Referral Form",
    description: "Track patient referrals and reward programs",
    category: "Marketing",
    schema: {
      fields: [
        { id: "f1", type: "heading", label: "Refer a Friend", placeholder: "", helpText: "", required: false, validation: {}, options: [], order: 0 },
        { id: "f2", type: "paragraph", label: "Refer a friend and both of you receive a special discount on your next treatment!", placeholder: "", helpText: "", required: false, validation: {}, options: [], order: 1 },
        { id: "f3", type: "text", label: "Your Name", placeholder: "Your full name", helpText: "", required: true, validation: {}, options: [], order: 2 },
        { id: "f4", type: "phone", label: "Your Phone", placeholder: "50 123 4567", helpText: "", required: true, validation: {}, options: [], order: 3 },
        { id: "f5", type: "text", label: "Friend's Name", placeholder: "Your friend's name", helpText: "", required: true, validation: {}, options: [], order: 4 },
        { id: "f6", type: "phone", label: "Friend's Phone", placeholder: "50 123 4567", helpText: "", required: true, validation: {}, options: [], order: 5 },
        { id: "f7", type: "email", label: "Friend's Email", placeholder: "friend@email.com", helpText: "", required: false, validation: {}, options: [], order: 6 },
      ],
      settings: { ...defaultSettings, submitButtonText: "Submit Referral", successMessage: "Thank you for your referral! We will reach out to your friend shortly." },
    },
  },
];
