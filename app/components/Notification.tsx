'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface NotificationProps {
  messages: string[]
  onDismiss: (index: number) => void
}

export function Notification({ messages, onDismiss }: NotificationProps) {
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        onDismiss(messages.length - 1); // Dismiss the oldest notification (last in the array)
      }, 5000); // Dismiss oldest notification after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [messages, onDismiss]);

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2 flex flex-col">
      <AnimatePresence initial={false}>
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.3, transition: { duration: 0.5 } }}
            className="bg-green-500 text-white px-4 py-2 rounded-md shadow-lg"
          >
            <p>{message}</p>
            <button
              onClick={() => onDismiss(index)}
              className="absolute top-1 right-1 text-white"
              aria-label="Dismiss notification"
            >
              &times;
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

