"use server"

import { revalidatePath } from "next/cache"
import { getRequestUser } from "@/lib/auth"
import { isModerator } from "@/lib/moderator"
import { reviewMutation } from "@/lib/moderator-client"

export interface IReviewResult {
  ok: boolean
  error?: string
  status?: string
}

export async function reviewAction(
  id: number,
  action: "approve" | "reject" | "revert",
  note?: string,
): Promise<IReviewResult> {
  const user = await getRequestUser()
  if (!user) return { ok: false, error: "unauthenticated" }
  if (!isModerator(user.email)) return { ok: false, error: "forbidden" }

  try {
    const result = await reviewMutation(id, action, note)
    revalidatePath("/moderate")
    return { ok: true, status: result.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
