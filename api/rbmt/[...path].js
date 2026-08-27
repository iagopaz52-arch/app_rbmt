const UPSTREAM_ORIGIN = 'https://www.rbmt.org.br'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const requestUrl = new URL(
    request.url,
    `https://${request.headers.host || 'localhost'}`,
  )
  const requestPath = requestUrl.pathname.replace(/^\/api\/rbmt\/?/, '')
  const pathParts = requestPath
    ? requestPath.split('/').filter(Boolean)
    : (Array.isArray(request.query.path)
      ? request.query.path
      : [request.query.path].filter(Boolean)
    ).flatMap((part) => part.split('/').filter(Boolean))
  let upstreamPath
  try {
    upstreamPath = `/${pathParts.map((part) => encodeURIComponent(decodeURIComponent(part))).join('/')}`
  } catch (error) {
    return response.status(400).json({ error: 'Invalid article path' })
  }
  const upstreamUrl = `${UPSTREAM_ORIGIN}${upstreamPath}${requestUrl.search}`

  let upstreamResponse
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'RBMT article reader',
      },
    })
  } catch (error) {
    console.error('RBMT upstream request failed', error)
    return response.status(502).json({ error: 'Unable to reach the RBMT portal' })
  }

  const body = await upstreamResponse.text()
  response.status(upstreamResponse.status)
  response.setHeader(
    'Content-Type',
    upstreamResponse.headers.get('content-type') || 'text/html; charset=utf-8',
  )
  return response.send(body)
}
