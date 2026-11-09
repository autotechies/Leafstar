"use client";

import { Button } from "@/components/ui/Button";
import { TextInput, Textarea } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Feedback";
import { formatPhone } from "@/lib/formats";
import type { BusinessSettings } from "../queries";
import { saveBusinessDetails } from "../actions";
import { OriginalValues, useSaveAction } from "./shared";
import { ActionForm } from "@/components/ui/ActionForm";

export function BusinessDetailsForm({ settings }: { settings: BusinessSettings }) {
  const [state, action, pending] = useSaveAction(saveBusinessDetails);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const original = {
    business_name: settings.business_name,
    tagline: settings.tagline,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    address: settings.address,
    city: settings.city,
    gstin: settings.gstin,
    instagram: settings.instagram,
    facebook: settings.facebook ?? null,
    established_year: settings.established_year ?? null,
  };

  return (
    <ActionForm action={action} className="flex flex-col gap-6" noValidate>
      <OriginalValues values={original} />
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <TextInput label="Business name" name="business_name" required defaultValue={v?.business_name ?? settings.business_name} error={e.business_name} />
        <TextInput label="Tagline" name="tagline" defaultValue={v?.tagline ?? settings.tagline} error={e.tagline} />
        <TextInput
          label="Phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={v?.phone ?? (settings.phone ? formatPhone(settings.phone) : "")}
          helper="Shown on the website with a Call button."
          error={e.phone}
        />
        <TextInput
          label="WhatsApp number"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          defaultValue={v?.whatsapp ?? (settings.whatsapp ? formatPhone(settings.whatsapp) : "")}
          helper="Buyers' WhatsApp buttons open a chat with this number."
          error={e.whatsapp}
        />
        <TextInput label="Email" name="email" type="email" inputMode="email" autoComplete="email" defaultValue={v?.email ?? settings.email ?? ""} error={e.email} />
        <TextInput
          label="Instagram"
          name="instagram"
          prefix="@"
          autoCapitalize="none"
          defaultValue={v?.instagram ?? settings.instagram ?? ""}
          error={e.instagram}
        />
        <TextInput
          label="Facebook page"
          name="facebook"
          autoCapitalize="none"
          defaultValue={v?.facebook ?? settings.facebook ?? ""}
          helper="Paste the link to your page. Shown in the website footer."
          error={e.facebook}
        />
        <TextInput
          label="Year started"
          name="established_year"
          inputMode="numeric"
          defaultValue={v?.established_year ?? (settings.established_year ? String(settings.established_year) : "")}
          helper="Shown as “Since 2016” on the website."
          error={e.established_year}
        />
        <Textarea label="Address" name="address" rows={3} defaultValue={v?.address ?? settings.address ?? ""} error={e.address} className="md:col-span-2" />
        <TextInput label="City" name="city" autoComplete="address-level2" defaultValue={v?.city ?? settings.city ?? ""} error={e.city} />
        <TextInput
          label="GSTIN"
          name="gstin"
          autoCapitalize="characters"
          defaultValue={v?.gstin ?? settings.gstin ?? ""}
          helper="Used on invoices later. Not shown on the website."
          error={e.gstin}
        />
      </div>
      {state.status === "error" && state.message ? <FormMessage tone="error">{state.message}</FormMessage> : null}
      <div className="flex md:justify-end">
        <Button type="submit" loading={pending} fullWidth className="md:w-auto">
          Save business details
        </Button>
      </div>
    </ActionForm>
  );
}
