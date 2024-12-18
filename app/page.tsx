import React from 'react'
import { TabbedInterface } from './components/TabbedInterface'
import { FloatingButton } from './components/FloatingButton'

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <TabbedInterface />
      <FloatingButton />
    </div>
  )
}
