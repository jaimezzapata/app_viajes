import { motion } from 'framer-motion'
import type { PropsWithChildren } from 'react'

export default function Page({ children }: PropsWithChildren) {
  return (
    <motion.main
      className="mx-auto w-full max-w-md px-4 pb-24 pt-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.main>
  )
}
