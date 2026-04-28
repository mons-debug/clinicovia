"use client";

import { Phone } from "lucide-react";
import { COUNTRY_CODES } from "@/lib/constants";

interface PhoneInputProps {
  countryCode: string;
  phone: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  required?: boolean;
  id?: string;
}

export function PhoneInput({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  required = false,
  id = "phone",
}: PhoneInputProps) {
  return (
    <div className="flex gap-2">
      <select
        className="w-[110px] rounded-lg border border-border bg-white py-2 pl-3 pr-1 text-sm text-text-primary focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        value={countryCode}
        onChange={(e) => onCountryCodeChange(e.target.value)}
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.code}
          </option>
        ))}
      </select>
      <div className="relative flex-1">
        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          id={id}
          type="tel"
          placeholder="50 123 4567"
          required={required}
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-4 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>
    </div>
  );
}
