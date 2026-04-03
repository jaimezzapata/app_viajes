import { Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cca2ToFlagEmoji } from '@/utils/flags'

export default function FlagAvatar({
  cca2,
  className = 'h-6 w-8',
  imgClassName = 'h-full w-full',
}: {
  cca2?: string | null
  className?: string
  imgClassName?: string
}) {
  const code = String(cca2 ?? '').trim().toLowerCase()
  const ok = /^[a-z]{2}$/.test(code)
  const src = ok ? `https://flagcdn.com/${code}.svg` : ''
  const [failed, setFailed] = useState(false)
  const emoji = useMemo(() => cca2ToFlagEmoji(String(cca2 ?? '').trim().toUpperCase()), [cca2])

  return (
    <div className={`flex items-center justify-center shrink-0 overflow-hidden border border-zinc-800/70 bg-zinc-950/40 p-0.5 ${className}`}>
      {ok && !failed ? (
        <img
          src={src}
          alt={code.toUpperCase()}
          className={`${imgClassName} object-contain`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : emoji ? (
        <span className="text-base leading-none">{emoji}</span>
      ) : (
        <Globe className="h-4 w-4 text-zinc-400" />
      )}
    </div>
  )
}
