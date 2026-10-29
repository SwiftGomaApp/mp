import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { LOGIN_CONTENT } from "../auth.content";
import type { ContactInput } from "../hooks/use-contact-input";
import { AuthField } from "./auth-field";

type ContactSwitchLinkProps = {
  contact: ContactInput;
};

/** The link that switches between e-mail and phone number. */
export function ContactSwitchLink({ contact }: ContactSwitchLinkProps) {
  return (
    <Pressable hitSlop={8} onPress={contact.switchMode} className="active:opacity-70">
      <Text className="font-sans-medium text-[13px] text-primary">
        {contact.mode === "email" ? LOGIN_CONTENT.usePhone : LOGIN_CONTENT.useEmail}
      </Text>
    </Pressable>
  );
}

type ContactFieldProps = {
  contact: ContactInput;
  /** Called by the keyboard's Go key on the e-mail field. */
  onSubmit: () => void;
  /** Shown at the end of the field, for example the round arrow. */
  accessory?: ReactNode;
  /**
   * Shows the switch link above the field (the default). Pass false to place a
   * `ContactSwitchLink` somewhere else.
   */
  showSwitch?: boolean;
  /** An error message shown under the field, which also turns its border red. */
  error?: string;
};

/** The e-mail or phone number field, with the link to switch between them above it. */
export function ContactField({
  contact,
  onSubmit,
  accessory,
  showSwitch = true,
  error,
}: ContactFieldProps) {
  return (
    <View>
      {showSwitch ? (
        <View className="mb-3 flex-row items-center justify-end px-1">
          <ContactSwitchLink contact={contact} />
        </View>
      ) : null}

      {contact.mode === "email" ? (
        <AuthField
          key="email"
          icon={{ ios: "envelope", android: "mail" }}
          placeholder={LOGIN_CONTENT.emailPlaceholder}
          value={contact.email}
          onChangeText={contact.setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          accessory={accessory}
          error={error}
        />
      ) : (
        <AuthField
          key="phone"
          icon={{ ios: "phone", android: "call" }}
          prefix={contact.countryCode}
          placeholder={LOGIN_CONTENT.phonePlaceholder}
          value={contact.phone}
          onChangeText={contact.setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessory={accessory}
          error={error}
        />
      )}
    </View>
  );
}
