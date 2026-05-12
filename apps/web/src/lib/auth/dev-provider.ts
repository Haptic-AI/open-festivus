import type { IAuthProvider, IUser } from "@festivus/types"

const DEV_USER: IUser = {
  id: "dev-user",
  email: "dev@localhost",
  name: "Dev User",
  imageUrl: null,
}

export class DevAuthProvider implements IAuthProvider {
  async getUser(): Promise<IUser | null> {
    return DEV_USER
  }
}
