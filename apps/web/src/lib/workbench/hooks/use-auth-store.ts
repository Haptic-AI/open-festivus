import { useMemo } from "react"
import { useUser } from "@clerk/nextjs"
import type { IProjectStore } from "@festivus/types"
import { ApiProjectStore } from "../store/api-store"
import { LocalProjectStore } from "../store/local-store"

interface IUseAuthStoreResult {
  store: IProjectStore
  isSignedIn: boolean
  isLoaded: boolean
}

const apiStore = new ApiProjectStore()
const localStore = new LocalProjectStore()

export function useAuthStore(): IUseAuthStoreResult {
  const { isSignedIn, isLoaded } = useUser()

  const store = useMemo<IProjectStore>(
    () => (isSignedIn ? apiStore : localStore),
    [isSignedIn],
  )

  return { store, isSignedIn: isSignedIn ?? false, isLoaded }
}
