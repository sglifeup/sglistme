'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import dynamic from 'next/dynamic'
import { FavoritesList } from './FavoritesList'

const DataTable = dynamic(() => import('./DataTable'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">Loading...</div>,
})

export function TabbedInterface() {
  const [activeTab, setActiveTab] = useState("listings")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="listings">Property Listings</TabsTrigger>
        <TabsTrigger value="favorites">Favorites</TabsTrigger>
      </TabsList>
      <TabsContent value="listings">
        <DataTable isFavoritesTab={false} />
      </TabsContent>
      <TabsContent value="favorites">
        <DataTable isFavoritesTab={true} />
      </TabsContent>
    </Tabs>
  )
}

