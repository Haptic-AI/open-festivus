import { auth, currentUser } from "@clerk/nextjs/server"
import type { IAuthProvider, IUser } from "@festivus/types"

export class ClerkAuthProvider implements IAuthProvider {
  async getUser(): Promise<IUser | null> {
    const { userId } = await auth()
    if (userId === null) return null

    const user = await currentUser()
    if (user === null) return null

    return {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress ?? null,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      imageUrl: user.imageUrl ?? null,
    }
  }
}
