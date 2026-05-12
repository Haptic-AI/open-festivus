import type { IAuthProvider, IUser } from "@festivus/types"
import { ClerkAuthProvider } from "./clerk-provider"
import { DevAuthProvider } from "./dev-provider"

export function getAuthProvider(): IAuthProvider {
  if (process.env["CLERK_SECRET_KEY"]) {
    return new ClerkAuthProvider()
  }
  return new DevAuthProvider()
}

export async function getRequestUser(): Promise<IUser | null> {
  return getAuthProvider().getUser()
}
