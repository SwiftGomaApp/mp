import type { AuthContext } from "./context";
import { isRecord, unexpectedAnswer } from "./answers";

export interface PasswordApi {
  /** Adds a password to an account that has none. `code` is a step-up code. */
  create(input: { password: string; code: string }): Promise<{ message: string }>;
  /** Changes the password. `code` is a step-up code. */
  change(input: {
    currentPassword: string;
    newPassword: string;
    code: string;
  }): Promise<{ message: string }>;
  /** Removes the password. The account must keep another way to sign in. `code` is a step-up code. */
  remove(input: { code: string }): Promise<{ message: string }>;
  /** Sends a reset code by e-mail. The answer is the same whether or not the account exists. */
  forgot(input: { email: string }): Promise<{ message: string }>;
  /** Sets a new password with the code from the e-mail. The user signs in again afterwards. */
  reset(input: { email: string; code: string; newPassword: string }): Promise<{ message: string }>;
}

export function createPasswordApi(ctx: AuthContext): PasswordApi {
  const send = async (
    method: "post" | "put",
    path: string,
    body: object,
  ): Promise<{ message: string }> => {
    const response = await ctx.client.request<unknown>({ method, url: path, data: body });
    const data = response.data;
    if (!isRecord(data) || typeof data.message !== "string") throw unexpectedAnswer(response);
    return { message: data.message };
  };

  return {
    create: (input) => send("post", "/auth/password", input),
    change: (input) => send("put", "/auth/password", input),
    remove: (input) => send("post", "/auth/password/remove", input),
    forgot: (input) => send("post", "/auth/password/forgot", input),
    reset: (input) => send("post", "/auth/password/reset", input),
  };
}
