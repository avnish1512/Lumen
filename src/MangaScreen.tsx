// Manga browsing + reading screen (Netflix/Anime UI). Backed by MangaDex via
// src/manga.ts, which restricts requests to non-explicit content ratings only.

import { ChevronLeft, LoaderCircle, Search, BookOpen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchChapterPages,
  fetchChapters,
  fetchPopularManga,
  searchManga,
  type MangaChapter,
  type MangaSummary,
} from './manga'

type MangaScreenProps = {
  onBack: () => void
}

type View = 'browse' | 'detail' | 'reader'

export function MangaScreen({ onBack }: MangaScreenProps) {
  const [view, setView] = useState<View>('browse')
  const [query, setQuery] = useState('')
  const [list, setList] = useState<MangaSummary[]>([])
  const [listLoading, setListLoading] = useState(false)

  const [selected, setSelected] = useState<MangaSummary | null>(null)
  const [chapters, setChapters] = useState<MangaChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const [chapterIndex, setChapterIndex] = useState(0)
  const [pages, setPages] = useState<string[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const readerRef = useRef<HTMLDivElement | null>(null)

  // Initial popular list.
  useEffect(() => {
    setListLoading(true)
    void fetchPopularManga()
      .then(setList)
      .finally(() => setListLoading(false))
  }, [])

  // Debounced search.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setListLoading(true)
      void searchManga(query)
        .then(setList)
        .finally(() => setListLoading(false))
    }, 350)
    return () => window.clearTimeout(handle)
  }, [query])

  const openManga = (manga: MangaSummary) => {
    setSelected(manga)
    setView('detail')
    setChapters([])
    setChaptersLoading(true)
    void fetchChapters(manga.id)
      .then(setChapters)
      .finally(() => setChaptersLoading(false))
  }

  const openChapter = (index: number) => {
    const chapter = chapters[index]
    if (!chapter) return
    setChapterIndex(index)
    setView('reader')
    setPages([])
    setPagesLoading(true)
    void fetchChapterPages(chapter.id)
      .then(setPages)
      .finally(() => setPagesLoading(false))
    readerRef.current?.scrollTo({ top: 0 })
  }

  const hasPrev = chapterIndex > 0
  const hasNext = chapterIndex < chapters.length - 1

  const currentChapter = chapters[chapterIndex]

  const readerTitle = useMemo(() => {
    if (!selected) return 'Reader'
    const num = currentChapter?.chapter ? `Ch. ${currentChapter.chapter}` : ''
    return `${selected.title}${num ? ` · ${num}` : ''}`
  }, [selected, currentChapter])

  // ---- Reader ----
  if (view === 'reader') {
    return (
      <section className="screen manga-screen">
        <header className="manga-reader-bar">
          <button className="manga-back" type="button" onClick={() => setView('detail')}>
            <ChevronLeft size={22} />
          </button>
          <span className="manga-reader-title">{readerTitle}</span>
          <div className="manga-reader-nav">
            <button type="button" disabled={!hasPrev} onClick={() => openChapter(chapterIndex - 1)}>
              Prev
            </button>
            <button type="button" disabled={!hasNext} onClick={() => openChapter(chapterIndex + 1)}>
              Next
            </button>
          </div>
        </header>

        <div className="manga-reader" ref={readerRef}>
          {pagesLoading ? (
            <div className="manga-empty">
              <LoaderCircle className="spin-icon" />
              <p>Loading pages…</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="manga-empty">
              <BookOpen size={40} />
              <p>No pages available for this chapter.</p>
            </div>
          ) : (
            pages.map((src, index) => (
              <img key={src} src={src} alt={`Page ${index + 1}`} loading="lazy" />
            ))
          )}
          {!pagesLoading && pages.length > 0 && (
            <div className="manga-reader-footer">
              {hasNext ? (
                <button type="button" onClick={() => openChapter(chapterIndex + 1)}>
                  Next chapter
                </button>
              ) : (
                <span>You're all caught up.</span>
              )}
            </div>
          )}
        </div>
      </section>
    )
  }

  // ---- Detail (chapter list) ----
  if (view === 'detail' && selected) {
    return (
      <section className="screen manga-screen">
        <header className="manga-topbar">
          <button className="manga-back" type="button" onClick={() => setView('browse')}>
            <ChevronLeft size={22} />
            <span>Back</span>
          </button>
        </header>

        <div className="manga-detail">
          <div className="manga-detail-head">
            <img className="manga-detail-cover" src={selected.coverUrl} alt={selected.title} />
            <div className="manga-detail-meta">
              <h1>{selected.title}</h1>
              <p className="manga-detail-sub">
                {selected.status ? selected.status.replace(/^\w/, (c) => c.toUpperCase()) : 'Manga'}
                {selected.year ? ` · ${selected.year}` : ''}
              </p>
              <p className="manga-detail-desc">{selected.description || 'No description available.'}</p>
              {chapters.length > 0 && (
                <button className="manga-read-btn" type="button" onClick={() => openChapter(0)}>
                  <BookOpen size={18} /> Start reading
                </button>
              )}
            </div>
          </div>

          <h2 className="manga-chapters-title">Chapters</h2>
          {chaptersLoading ? (
            <div className="manga-empty">
              <LoaderCircle className="spin-icon" />
              <p>Loading chapters…</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="manga-empty">
              <p>No English chapters available for this title.</p>
            </div>
          ) : (
            <ul className="manga-chapters">
              {chapters.map((chapter, index) => (
                <li key={chapter.id}>
                  <button type="button" onClick={() => openChapter(index)}>
                    <span className="manga-chapter-num">
                      {chapter.chapter ? `Chapter ${chapter.chapter}` : 'Oneshot'}
                    </span>
                    {chapter.title && <span className="manga-chapter-name">{chapter.title}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    )
  }

  // ---- Browse (grid) ----
  return (
    <section className="screen manga-screen">
      <header className="manga-topbar">
        <button className="manga-back" type="button" onClick={onBack}>
          <ChevronLeft size={22} />
          <span>Back</span>
        </button>
        <div className="manga-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search manga…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search manga"
          />
        </div>
      </header>

      <div className="manga-browse">
        <h1 className="manga-heading">Manga</h1>
        {listLoading ? (
          <div className="manga-empty">
            <LoaderCircle className="spin-icon" />
            <p>Loading…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="manga-empty">
            <BookOpen size={40} />
            <p>No manga found.</p>
          </div>
        ) : (
          <div className="manga-grid">
            {list.map((manga) => (
              <button
                key={manga.id}
                type="button"
                className="manga-card"
                onClick={() => openManga(manga)}
              >
                <span className="manga-card-cover">
                  <img src={manga.coverUrl} alt={manga.title} loading="lazy" />
                </span>
                <span className="manga-card-title">{manga.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default MangaScreen
