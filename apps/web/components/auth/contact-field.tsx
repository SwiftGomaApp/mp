"use client";

import { useState } from "react";

import { Field, FieldDescription, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValidEmail, type VerificationMethod } from "@/lib/auth-flow";
import { formatDrcNational, parseDrcPhone, toDrcNationalDigits } from "@/lib/phone";

function DrcFlag() {
  return (
    <svg
      viewBox="0 0 30 20"
      role="img"
      aria-label="Drapeau de la RDC"
      className="size-auto h-3.5 w-5.25 rounded-xs"
    >
      <rect width="30" height="20" fill="#007fff" />
      <path d="M-1 21 L31 -1" stroke="#f7d618" strokeWidth="5.6" />
      <path d="M-1 21 L31 -1" stroke="#ce1021" strokeWidth="3.6" />
      <polygon
        fill="#f7d618"
        points="6,1.8 6.82,4.07 9.23,4.15 7.33,5.63 8,7.95 6,6.6 4,7.95 4.67,5.63 2.77,4.15 5.18,4.07"
      />
    </svg>
  );
}

export function useContactField() {
  const [method, setMethod] = useState<VerificationMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const parsedPhone = parseDrcPhone(phone);
  const isValid = method === "email" ? isValidEmail(email) : parsedPhone.valid;
  const contact = method === "email" ? email.trim() : (parsedPhone.e164 ?? "");

  const handlePhoneChange = (value: string) => {
    const deletedSeparator =
      value.length < phone.length && toDrcNationalDigits(value) === toDrcNationalDigits(phone);

    setPhone(formatDrcNational(deletedSeparator ? toDrcNationalDigits(value).slice(0, -1) : value));
  };

  return { method, setMethod, email, setEmail, phone, handlePhoneChange, isValid, contact };
}

interface ContactFieldProps {
  state: ReturnType<typeof useContactField>;
  disabled?: boolean;
  webauthn?: boolean;
  switcher?: "link" | "tabs";
  /** The "Ou continuer avec" line above the field. */
  showSeparator?: boolean;
}

export function ContactField({
  state,
  disabled,
  webauthn,
  switcher = "link",
  showSeparator = true,
}: ContactFieldProps) {
  const { method, setMethod, email, setEmail, phone, handlePhoneChange } = state;

  return (
    <>
      {showSeparator && (
        <FieldSeparator className="w-full">
          {switcher === "tabs"
            ? "Ou continuer avec"
            : method === "email"
              ? "Ou continuer avec votre e-mail"
              : "Ou continuer avec votre numéro"}
        </FieldSeparator>
      )}

      {switcher === "tabs" && (
        <Tabs
          value={method}
          onValueChange={(value) => setMethod(value as VerificationMethod)}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="email" disabled={disabled}>
              E-mail
            </TabsTrigger>
            <TabsTrigger value="phone" disabled={disabled}>
              Téléphone
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Field>
        {method === "email" ? (
          <>
            <FieldLabel htmlFor="email" className="sr-only">
              Adresse e-mail
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete={webauthn ? "email webauthn" : "email"}
              placeholder="Adresse e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={disabled}
              className="h-10"
              required
            />
          </>
        ) : (
          <>
            <FieldLabel htmlFor="phone" className="sr-only">
              Numéro de téléphone
            </FieldLabel>
            <InputGroup className="h-10">
              <InputGroupAddon>
                <InputGroupText>
                  <DrcFlag />
                  +243
                </InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="8X XXX XXXX"
                value={phone}
                onChange={(event) => handlePhoneChange(event.target.value)}
                disabled={disabled}
                required
                autoFocus
              />
            </InputGroup>
            <FieldDescription className="text-xs">
              Seuls les numéros de la RDC (+243) sont acceptés.
            </FieldDescription>
          </>
        )}
        {switcher === "link" && (
          <button
            type="button"
            onClick={() => setMethod(method === "email" ? "phone" : "email")}
            disabled={disabled}
            className="mx-auto text-xs text-muted-foreground underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline disabled:pointer-events-none disabled:opacity-50"
          >
            {method === "email"
              ? "Continuer avec un numéro de téléphone"
              : "Continuer avec une adresse e-mail"}
          </button>
        )}
      </Field>
    </>
  );
}
