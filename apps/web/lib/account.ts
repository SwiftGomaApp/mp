import { createAccount } from "swiftgoma-mp-auth/account";

import { auth, socials } from "@/lib/auth";
import { browserPasskeys } from "@/lib/auth-providers";

export const account = createAccount(auth, { socials, passkeys: browserPasskeys });
