'use client'

import { Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FloatingButton() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        className="rounded-full px-6 py-6 shadow-lg hover:shadow-xl transition-shadow"
        asChild
      >
        <a
          href="https://buy.stripe.com/9AQaIx4I87cR2IwdQQ"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Rocket className="mr-2 h-5 w-5" aria-hidden="true" />
          <span>Boost Listings</span>
        </a>
      </Button>
    </div>
  )
}

