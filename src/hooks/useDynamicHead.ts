import { useEffect, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { categoryIconMap } from '@/components/AnimatedIcon'

export function useDynamicHead(title: string, iconName: string) {
  useEffect(() => {
    // Actualiza el título de la página
    document.title = `${title} | App Viajes`

    const Icon = categoryIconMap[iconName]
    if (!Icon) return

    // Color theme-sky-400 (#38bdf8)
    const svgComponent = createElement(Icon, { color: '#38bdf8', size: 64, strokeWidth: 2 })
    const svgMarkup = renderToStaticMarkup(svgComponent)
    
    // Create valid standalone SVG by injecting xmlns if missing
    const validSvg = svgMarkup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')

    const faviconUrl = `data:image/svg+xml,${encodeURIComponent(validSvg)}`

    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/svg+xml'
    link.href = faviconUrl
  }, [title, iconName])
}
