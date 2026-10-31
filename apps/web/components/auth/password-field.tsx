"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  disabled?: boolean;
  autoFocus?: boolean;
}

/** A labelled password input with a show/hide button. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  autoFocus,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-xs">
        {label}
      </FieldLabel>
      <InputGroup className="h-10">
        <InputGroupAddon>
          <Lock />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={visible}
            disabled={disabled}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
