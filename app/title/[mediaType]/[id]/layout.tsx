import { notFound } from 'next/navigation'
import { parseMediaType, parseTmdbId } from '@/lib/route-params'

export default async function TitleLayout({
  params,
  children,
}: LayoutProps<'/title/[mediaType]/[id]'>) {
  const { mediaType: rawMediaType, id: rawId } = await params
  const mediaType = parseMediaType(rawMediaType)
  const id = parseTmdbId(rawId)
  if (!mediaType || !id) notFound()

  return children
}
