// Manga browsing + reading screen (Netflix/Anime UI). Backed by MangaDex via
// src/manga.ts, proxied through /api/mangahook.

import { ChevronLeft, LoaderCircle, Search, BookOpen, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchChapterPages,
  fetchChapters,
  fetchPopularManga,
  searchManga,
  type MangaChapter,
  type MangaSummary,
} from './manga'
import { ProfileMenu, renderProfileAvatarMini, type UserInfo, type UserProfile } from './App'

type MangaScreenProps = {
  onBack: () => void
  currentUser?: UserInfo | null
  onProfile?: () => void
  profiles?: UserProfile[]
  onSelectProfile?: (profileName: string) => void
  onManageProfiles?: () => void
  onTransferProfile?: () => void
  onAccount?: () => void
  onHelp?: () => void
  onSignOut?: () => void
  onSetLordPin?: () => void
}

type View = 'browse' | 'detail' | 'reader'

export function MangaScreen({
  onBack: _onBack,
  currentUser = null,
  onProfile,
  profiles = [],
  onSelectProfile,
  onManageProfiles,
  onTransferProfile,
  onAccount,
  onHelp,
  onSignOut,
  onSetLordPin,
}: MangaScreenProps) {
  const [view, setView] = useState<View>('browse')
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [list, setList] = useState<MangaSummary[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  // Bumped on every new query so in-flight responses from a previous query are
  // ignored instead of clobbering the current results.
  const requestToken = useRef(0)

  const [selected, setSelected] = useState<MangaSummary | null>(null)
  const [chapters, setChapters] = useState<MangaChapter[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(false)

  const [chapterIndex, setChapterIndex] = useState(0)
  const [pages, setPages] = useState<string[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const readerRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Load (or reload) the first page whenever the query changes. Empty query
  // loads the popular list immediately; typed queries are debounced.
  useEffect(() => {
    const trimmed = query.trim()
    const handle = window.setTimeout(() => {
      const token = ++requestToken.current
      setListLoading(true)
      setList([])
      setHasMore(false)
      const request = trimmed ? searchManga(trimmed, 1) : fetchPopularManga(1)
      void request
        .then((result) => {
          if (token !== requestToken.current) return
          setList(result.items)
          setPage(1)
          setHasMore(result.hasMore)
        })
        .finally(() => {
          if (token === requestToken.current) setListLoading(false)
        })
    }, trimmed ? 350 : 0)
    return () => window.clearTimeout(handle)
  }, [query])

  const loadMore = useCallback(() => {
    if (listLoading || loadingMore || !hasMore) return
    const nextPage = page + 1
    const token = requestToken.current
    setLoadingMore(true)
    const trimmed = query.trim()
    const request = trimmed ? searchManga(trimmed, nextPage) : fetchPopularManga(nextPage)
    void request
      .then((result) => {
        if (token !== requestToken.current) return
        setList((prev) => [...prev, ...result.items])
        setPage(nextPage)
        setHasMore(result.hasMore)
      })
      .finally(() => {
        if (token === requestToken.current) setLoadingMore(false)
      })
  }, [hasMore, listLoading, loadingMore, page, query])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadMore])

  const openManga = useCallback((manga: MangaSummary) => {
    setSelected(manga)
    setView('detail')
    setChapters([])
    setChaptersLoading(true)
    void fetchChapters(manga.id)
      .then(setChapters)
      .finally(() => setChaptersLoading(false))
  }, [])

  const openChapter = useCallback((index: number) => {
    const chapter = chapters[index]
    if (!chapter || !selected) return
    setChapterIndex(index)
    setView('reader')
    setPages([])
    setPagesLoading(true)
    void fetchChapterPages(selected.id, chapter.id)
      .then(setPages)
      .finally(() => setPagesLoading(false))
    readerRef.current?.scrollTo({ top: 0 })
  }, [chapters, selected])

  const hasNext = chapterIndex < chapters.length - 1

  const renderHeaderProfile = () => {
    if (onSelectProfile && onManageProfiles && onTransferProfile && onAccount && onHelp && onSignOut) {
      return (
        <ProfileMenu
          currentUser={currentUser}
          profiles={profiles}
          variant="apple"
          onSelectProfile={onSelectProfile}
          onManageProfiles={onManageProfiles}
          onTransferProfile={onTransferProfile}
          onAccount={onAccount}
          onHelp={onHelp}
          onSignOut={onSignOut}
          onSetLordPin={onSetLordPin}
        />
      )
    }
    return (
      <button
        className={`avatar-button ${currentUser ? 'has-avatar' : ''}`}
        type="button"
        title="Profile"
        onClick={onProfile}
      >
        {renderProfileAvatarMini(currentUser, profiles)}
      </button>
    )
  }

  // ---- Reader ----
  if (view === 'reader' && selected) {
    const currentChapter = chapters[chapterIndex]
    return (
      <section className="screen manga-screen manga-reader-screen" ref={readerRef}>
        <header className="home-header">
          <button className="manga-back" type="button" onClick={() => setView('detail')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 0, color: '#fff' }}>
            <ChevronLeft size={22} />
            <span>Back</span>
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: '700' }}>
            {currentChapter?.chapter ? `Ch. ${currentChapter.chapter}` : selected.title}
          </h1>
          {renderHeaderProfile()}
        </header>

        <div className="manga-reader-body">
          {pagesLoading ? (
            <div className="manga-empty">
              <LoaderCircle className="spin-icon" />
              <p>Loading chapter pages…</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="manga-empty">
              <BookOpen size={40} />
              <p>No pages available for this chapter.</p>
            </div>
          ) : (
            <div className="manga-pages-vertical">
              {pages.map((src, index) => (
                <img key={src} src={src} alt={`Page ${index + 1}`} loading="lazy" className="manga-page-img" referrerPolicy="no-referrer" />
              ))}
            </div>
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
        <header className="home-header">
          <button className="manga-back" type="button" onClick={() => setView('browse')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 0, color: '#fff' }}>
            <ChevronLeft size={22} />
            <span>Back</span>
          </button>
          <h1 style={{ fontSize: '18px', fontWeight: '700' }}>{selected.title}</h1>
          {renderHeaderProfile()}
        </header>

        <div className="manga-detail">
          <div className="manga-detail-head">
            <img className="manga-detail-cover" src={selected.coverUrl} alt={selected.title} referrerPolicy="no-referrer" />
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

          <h2 className="manga-chapters-heading">Chapters ({chapters.length})</h2>
          {chaptersLoading ? (
            <div className="manga-empty">
              <LoaderCircle className="spin-icon" />
              <p>Loading chapters…</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="manga-empty">
              <BookOpen size={40} />
              <p>No chapters found for this title.</p>
            </div>
          ) : (
            <ul className="manga-chapter-list">
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
      <header className="home-header">
        <h1>Manga</h1>
        <div className="header-actions">
          <button
            className="mobile-search-btn"
            type="button"
            title="Search Manga"
            onClick={() => setShowSearch((prev) => !prev)}
          >
            <Search size={22} />
          </button>
          {renderHeaderProfile()}
        </div>
      </header>

      {(showSearch || query.trim().length > 0) && (
        <div className="manga-search-bar-row">
          <Search size={18} className="manga-search-icon" />
          <input
            type="text"
            className="manga-horizontal-search-input"
            placeholder="Search manga by title…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            aria-label="Search manga"
          />
          {query && (
            <button
              type="button"
              className="manga-search-clear-btn"
              onClick={() => setQuery('')}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="manga-browse">
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
          <>
            <div className="manga-grid">
              {list.map((manga) => (
                <button
                  key={manga.id}
                  type="button"
                  className="manga-card"
                  onClick={() => openManga(manga)}
                >
                  <span className="manga-card-cover">
                    <img src={manga.coverUrl} alt={manga.title} loading="lazy" referrerPolicy="no-referrer" />
                  </span>
                  <span className="manga-card-title">{manga.title}</span>
                </button>
              ))}
            </div>
            {hasMore && <div ref={sentinelRef} className="manga-scroll-sentinel" />}
            {loadingMore && (
              <div className="manga-empty manga-empty-more">
                <LoaderCircle className="spin-icon" />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default MangaScreen
