const PORTAL_ORIGIN = 'https://www.rbmt.org.br'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const source = request.query.url
  if (typeof source !== 'string') {
    return response.status(400).json({ error: 'Article URL is required' })
  }
  let articleUrl
  try {
    articleUrl = new URL(source)
  } catch {
    return response.status(400).json({ error: 'Invalid article URL' })
  }

  if (articleUrl.origin !== PORTAL_ORIGIN || !articleUrl.pathname.startsWith('/details/')) {
    return response.status(400).json({ error: 'Invalid article source' })
  }

  let upstreamResponse
  try {
    upstreamResponse = await fetch(articleUrl, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'RBMT article reader',
      },
    })
  } catch (error) {
    console.error('RBMT article request failed', error)
    return response.status(502).json({ error: 'Unable to reach the RBMT portal' })
  }

  response.status(upstreamResponse.status)
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  return response.send(await upstreamResponse.text())
}
