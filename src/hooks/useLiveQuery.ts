import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

export function useLiveQuery<T>(queryFactory: () => Promise<T> | T, deps: unknown[], initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)
  const [error, setError] = useState<unknown>(null)

  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    const observable = liveQuery(async () => await queryFactory())
    const sub = observable.subscribe({
      next: (v) => {
        setValue(v)
        setError(null)
      },
      error: (e) => {
        setError(e)
      },
    })
    return () => sub.unsubscribe()
  }, [depsKey])

  return { value, error }
}
