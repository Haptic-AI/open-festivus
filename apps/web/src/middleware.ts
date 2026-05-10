import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isClerkConfigured = Boolean(process.env["CLERK_SECRET_KEY"])

// Pages: keep `auth.protect()` so signed-out visitors are bounced to the
// Clerk sign-in flow (rewrite is fine — Vercel doesn't cache it because
// /sign-in is a dynamic route).
//
// APIs: do NOT short-circuit here. Every protected API route already calls
// `getRequestUser()` and returns its own 401, and dynamic route handlers
// (`ƒ`) aren't cached by Vercel — so the 404-cache-poisoning that this
// matcher used to cause cannot recur. Calling middleware-bound `auth()` was
// also returning null for signed-in users in prod (root cause of "Could not
// create key" on /settings/api-keys), defeating the route handler before it
// ran.
export const isProtectedPage = createRouteMatcher([
  "/settings(.*)",
])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (isProtectedPage(req)) {
    await auth.protect()
  }
})

export default isClerkConfigured
  ? clerkHandler
  : function noopMiddleware() { return NextResponse.next() }

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
