import { createAccount } from "swiftgoma-mp-auth/account";

import { auth } from "@/lib/auth";

export const account = createAccount(auth);
