import { useEffect, useState } from 'react'

const SITE_URL = 'https://www.rbmt.org.br'

function absoluteUrl(value) {
  return value ? new URL(value, SITE_URL).href : ''
}

function textOf(element) {
  return element?.textContent?.replace(/\s+/g, ' ').trim() || ''
}

function abstractSections(value) {
  const sections = []
  const matcher = /(INTRODUÇÃO|OBJETIVOS|MÉTODOS|RESULTADOS|CONCLUSÕES)\s*:\s*/gi
  let match
  let previousEnd = 0
  let currentLabel = ''
  while ((match = matcher.exec(value || ''))) {
    if (currentLabel) sections.push({ label: currentLabel, text: value.slice(previousEnd, match.index).trim() })
    currentLabel = match[1]
    previousEnd = matcher.lastIndex
  }
  if (currentLabel) sections.push({ label: currentLabel, text: value.slice(previousEnd).trim() })
  return sections.length ? sections : [{ label: 'Resumo', text: value }]
}

function parseIssue(html) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const title = textOf(document.querySelector('.page-title')) || 'Edição atual'
  const articleLinks = [...document.querySelectorAll('h5 a[href*="/details/"]')]
  const links = articleLinks.length
    ? articleLinks
    : [...document.querySelectorAll('a[href*="/details/"]')]
  const articles = links.map((heading) => {
    const card = heading.closest('.col-lg-12') || heading.parentElement?.parentElement
    const detailUrl = absoluteUrl(heading.getAttribute('href'))
    const pdf = card?.querySelector('a[href*="/export-pdf/"]')?.getAttribute('href')
    const authors = textOf(card?.querySelector('.news-meta-date'))?.split('Rev Bras Med Trab.')[0].trim()
    const abstract = card?.querySelector('.section-abstract')
    return {
      id: detailUrl,
      title: textOf(heading),
      authors: authors?.replace(/\s*;\s*/g, ', ') || 'Autores não informados',
      abstract: textOf(abstract),
      detailUrl,
      pdfUrl: absoluteUrl(pdf),
    }
  })
  return { title, articles }
}

function parseArticle(html, article) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const authors = [...document.querySelectorAll('meta[name="citation_author"]')]
    .map((meta) => meta.content)
    .join(', ')
  const body = document.querySelector('#body-article')
  if (!body) throw new Error('O conteúdo completo do artigo não foi encontrado.')
  body?.querySelectorAll('.nav-tabs, script, style')?.forEach((element) => element.remove())
  document.querySelector('#header-article h1.small')?.remove()
  const content = body.querySelector('.row > .col-lg-12') || body
  const images = [...content.querySelectorAll('img')].map((image) => {
    const src = absoluteUrl(
      image.getAttribute('src') || image.getAttribute('data-src'),
    )
    image.setAttribute('src', src)
    image.removeAttribute('srcset')
    image.removeAttribute('data-src')
    return {
      src,
      alt: image.getAttribute('alt') || '',
    }
  })
  const contentHtml = content.innerHTML
  const text = /INTRODUÇÃO|INTRODUCTION/i.test(contentHtml)
    ? contentHtml
    : body.innerHTML
  if (!text.trim()) throw new Error('O texto completo do artigo está vazio.')
  const pdf = [...document.querySelectorAll('a[href*="/export-pdf/"]')][0]?.getAttribute('href')
  return {
    ...article,
    authors: authors || article.authors,
    contentHtml: text,
    images,
    pdfUrl: absoluteUrl(pdf) || article.pdfUrl,
  }
}

async function fetchSource(path) {
  const endpoint = `/api/rbmt${path}`
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error(`Não foi possível acessar a fonte (${response.status}).`)
  return response.text()
}

function App() {
  const [issue, setIssue] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [articleLoading, setArticleLoading] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installMessage, setInstallMessage] = useState('')

  useEffect(() => {
    fetchSource('/article-list')
      .then((html) => setIssue(parseIssue(html)))
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
  }, [])

  async function installApp() {
    if (!installPrompt) {
      setInstallMessage('No Android Chrome, toque no menu ⋮ e escolha "Adicionar à tela inicial".')
      return
    }
    installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallMessage('RBMT adicionado à sua tela inicial.')
    setInstallPrompt(null)
  }

  useEffect(() => {
    if (!lightbox) return undefined
    const closeWithEscape = (event) => {
      if (event.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [lightbox])

  async function openArticle(article) {
    setSelected(article)
    setDrawerOpen(false)
    if (article.contentHtml) return
    setArticleLoading(true)
    setError('')
    try {
      const html = await fetch(`/api/article?url=${encodeURIComponent(article.detailUrl)}`, {
        cache: 'no-store',
      })
        .then((response) => {
          if (!response.ok) throw new Error(`Não foi possível acessar o artigo (${response.status}).`)
          return response.text()
        })
      setSelected(parseArticle(html, article))
    } catch (reason) {
      setError(reason.message)
    } finally {
      setArticleLoading(false)
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1320px] overflow-hidden px-4 py-5 text-[#182522] sm:px-12 sm:py-11">
      <header className="relative border-b border-[#dbe3df] pb-7 sm:pb-12">
        <div className="max-w-full break-words font-mono text-[10px] font-medium uppercase tracking-[.1em] text-[#2b756a] sm:text-[11px] sm:tracking-[.12em]">RBMT · Revista Brasileira de Medicina do Trabalho</div>
        <h1 className="mt-4 max-w-[700px] text-4xl font-bold leading-[1.05] tracking-[-.04em] sm:text-[clamp(38px,5vw,68px)] sm:leading-[1.02]">Projeto de APP - Leitura de Artigos</h1>
        <p className="max-w-prose text-sm leading-relaxed text-[#6b7b75] sm:text-base mt-3">Conteúdo da edição atual, coletado diretamente do portal da RBMT.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 sm:absolute sm:right-0 sm:top-2 sm:mt-0 sm:justify-end">
          <button className="inline-flex min-h-11 items-center border border-[#2b756a] px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-[#2b756a] hover:bg-[#c7ebe0]" onClick={installApp}>＋ Adicionar à tela inicial</button>
          <a className="inline-block min-h-11 py-3 font-mono text-[11px] font-medium uppercase tracking-[.05em] text-[#2b756a]" href={SITE_URL} target="_blank" rel="noreferrer">Visitar rbmt.org.br ↗</a>
        </div>
      </header>

      {installMessage && <div className="my-4 bg-[#e9f5f0] px-4 py-3 text-sm text-[#2b756a]" role="status">{installMessage}</div>}
      {error && <div className="my-5 bg-[#ffe8e5] px-5 py-3.5 text-[#9b3e35]" role="alert">{error}</div>}
      {loading ? <div className="py-[70px] text-[#6b7b75]">Consultando edição atual…</div> : (
        <section className="min-h-[640px]">
          <button
            className="my-5 inline-flex min-h-11 items-center gap-3 border border-[#2b756a] bg-transparent px-4 py-2 font-mono text-xs font-medium uppercase tracking-[.05em] text-[#2b756a] transition-colors hover:bg-[#c7ebe0]"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="article-drawer"
          >
            <span className="text-lg leading-none">☰</span>
            Artigos da edição
            <span className="rounded-full bg-[#2b756a] px-2 py-0.5 text-[10px] text-white">{issue?.articles.length || 0}</span>
          </button>
          <article className="min-w-0 max-w-[820px] px-0 py-6 sm:px-[7%] sm:py-[70px]">
            {!selected ? (
              <div className="mt-16 text-[#6b7b75] sm:mt-[120px]"><span className="text-[28px] text-[#2b756a]">✦</span><h2 className="text-[32px] font-semibold text-[#182522]">Selecione um artigo</h2><p>Abra a gaveta de artigos para consultar o texto completo e as imagens.</p></div>
            ) : articleLoading ? <div className="py-[70px] text-[#6b7b75]">Carregando texto e imagens…</div> : (
              <>
                <div className="font-mono text-[11px] font-medium uppercase tracking-[.12em] text-[#2b756a]">ARTIGO DA EDIÇÃO · TEXTO COMPLETO</div>
                <h2 className="my-3.5 break-words text-3xl font-bold leading-[1.08] tracking-[-.03em] sm:text-[clamp(30px,4vw,48px)]">{selected.title}</h2>
                <p className="text-[15px] text-[#6b7b75]">{selected.authors}</p>
                <div className="my-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-[22px]">
                  <a className="inline-flex min-h-11 items-center justify-center bg-[#182522] px-[18px] py-[13px] font-mono text-xs font-medium uppercase text-white no-underline" href={selected.pdfUrl} target="_blank" rel="noreferrer">Baixar PDF <span className="ml-2.5 text-[#c7ebe0]">↗</span></a>
                  <a className="inline-flex min-h-11 items-center font-mono text-[11px] font-medium uppercase tracking-[.05em] text-[#2b756a]" href={selected.detailUrl} target="_blank" rel="noreferrer">Abrir no portal</a>
                </div>
                {selected.abstract && <section className="mb-7 rounded-r-lg border-l-4 border-[#2b756a] bg-[#e9f5f0] p-4 sm:p-5 [&_p]:mt-3">
                  <h3 className="mb-3 font-mono text-xs font-semibold uppercase tracking-[.12em] text-[#2b756a]">Resumo</h3>
                  <div className="space-y-3">
                    {abstractSections(selected.abstract).map((section) => (
                      <p className="m-0 font-serif text-[15px] leading-[1.65] text-[#394943] sm:text-base" key={section.label}>
                        <strong className="mr-1 font-sans text-[11px] font-bold uppercase tracking-wide text-[#2b756a]">{section.label}:</strong>
                        {section.text}
                      </p>
                    ))}
                  </div>
                </section>}
                {<section
                  className="prose prose-slate max-w-none overflow-hidden font-serif text-base leading-[1.72] [&>div]:my-2.5 [&>h1]:mb-2.5 [&>h1]:mt-5 [&>h2]:mb-2.5 [&>h2]:mt-5 [&>h3]:mb-2.5 [&>h3]:mt-5 [&>p]:my-2.5 [&_img]:mx-auto [&_img]:my-3 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:cursor-zoom-in [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto sm:text-[17px] [&_b]:block [&_b]:mt-3 font-['Montserrat']"
                  onClick={(event) => {
                    const image = event.target.closest('img')
                    if (!image) return
                    event.preventDefault()
                    setZoom(1)
                    setLightbox({ src: image.src, alt: image.alt })
                  }}
                  dangerouslySetInnerHTML={{ __html: selected.contentHtml }}
                />}
              </>
            )}
          </article>
        </section>
      )}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-[#182522]/45" onClick={() => setDrawerOpen(false)}>
          <aside
            id="article-drawer"
            className="h-full w-[min(88vw,390px)] overflow-y-auto bg-[#f5f8f5] px-4 py-6 shadow-2xl sm:px-7 sm:py-9"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] font-medium uppercase tracking-[.12em] text-[#2b756a]">Edição atual</div>
                <p className="mt-2 text-[27px] font-semibold leading-tight">{issue?.title}</p>
                <p className="text-[13px] text-[#6b7b75]">{issue?.articles.length || 0} artigos encontrados</p>
              </div>
              <button className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#dbe3df] text-2xl text-[#182522]" onClick={() => setDrawerOpen(false)} aria-label="Fechar artigos">×</button>
            </div>
            <div className="sr-only">Lista de artigos</div>
            {issue?.articles.map((article, index) => (
              <button
                className={`grid min-h-11 w-full grid-cols-[30px_1fr] gap-2 border-t border-[#dbe3df] px-2.5 py-4 text-left text-[#182522] last:border-b hover:bg-[#c7ebe0] sm:grid-cols-[34px_1fr] sm:gap-3 sm:px-3 sm:py-[17px] ${selected?.id === article.id ? 'bg-[#c7ebe0]' : 'bg-transparent'}`}
                key={article.id}
                onClick={() => openArticle(article)}
              >
                <span className="pt-0.5 font-mono text-xs font-medium text-[#2b756a]">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0"><strong className="block break-words text-[13px] leading-[1.4] sm:text-sm">{article.title}</strong><small className="mt-1.5 block break-words text-[11px] leading-[1.4] text-[#6b7b75]">{article.authors}</small></span>
              </button>
            ))}
          </aside>
        </div>
      )}
      <footer className="border-t border-[#dbe3df] pt-5 font-mono text-[11px] text-[#6b7b75]">Dados públicos coletados de <a className="text-[#2b756a]" href={SITE_URL} target="_blank" rel="noreferrer">rbmt.org.br</a>.</footer>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#182522]/90 p-4 sm:p-10"
          role="dialog"
          aria-modal="true"
          aria-label="Visualizador de imagem"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null)
          }}
        >
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
            <img
              className="max-h-full max-w-full select-none object-contain transition-transform duration-200"
              src={lightbox.src}
              alt={lightbox.alt}
              style={{ transform: `scale(${zoom})` }}
            />
            <div className="absolute right-0 top-0 flex gap-2">
              <button className="flex h-11 w-11 items-center justify-center bg-white text-xl text-[#182522]" onClick={() => setZoom((value) => Math.min(value + 0.25, 4))} aria-label="Aumentar zoom">+</button>
              <button className="flex h-11 w-11 items-center justify-center bg-white text-xl text-[#182522]" onClick={() => setZoom((value) => Math.max(value - 0.25, 0.5))} aria-label="Reduzir zoom">−</button>
              <button className="flex h-11 w-11 items-center justify-center bg-[#c7ebe0] text-xl text-[#182522]" onClick={() => setLightbox(null)} aria-label="Fechar imagem">×</button>
            </div>
            <div className="absolute bottom-0 left-0 rounded bg-[#182522]/80 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-white">
              Clique fora para fechar · Zoom {Math.round(zoom * 100)}%
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
