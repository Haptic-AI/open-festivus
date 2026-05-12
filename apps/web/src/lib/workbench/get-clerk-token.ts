import { auth } from "@clerk/nextjs/server"

export async function getClerkToken(): Promise<string | null> {
  const { getToken } = await auth()
  return getToken()
}
