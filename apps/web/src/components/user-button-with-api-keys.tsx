"use client"

import { UserButton } from "@clerk/nextjs"
import { ApiKeysPanel } from "@/components/settings/ApiKeysPanel"

function KeyIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UserButtonWithApiKeys() {
  return (
    <UserButton>
      <UserButton.UserProfilePage label="API Keys" labelIcon={<KeyIcon />} url="api-keys">
        <div className="p-4">
          <ApiKeysPanel compact />
        </div>
      </UserButton.UserProfilePage>
    </UserButton>
  )
}
