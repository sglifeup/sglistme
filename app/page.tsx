import React from 'react'
import { TabbedInterface } from './components/TabbedInterface'
import { FloatingButton } from './components/FloatingButton'

export default function Home() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Property Listings</h1>
      <TabbedInterface />
      <FloatingButton />
    </div>
  )
}

