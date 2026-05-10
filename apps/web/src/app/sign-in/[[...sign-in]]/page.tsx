import { SignIn } from "@clerk/nextjs"
import { SiteHeader } from "@/components/site-header"

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <div className="flex min-h-[calc(100vh-52px)] items-center justify-center">
        <SignIn />
      </div>
    </>
  )
}
