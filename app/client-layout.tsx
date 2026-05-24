'use client'

import { ChallengeNotification } from '@/components/ChallengeNotification'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChallengeNotification />
      {children}
    </>
  )
}
