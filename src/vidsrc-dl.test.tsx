import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildVidsrcDownloadApiUrl } from '../api/_lib/vidsrc-dl-core'
import { DownloadEmbedModal } from './DownloadEmbedModal'
import { closeInSiteDownload, openInSiteDownload } from './downloads'

describe('dl.vidsrc.party Direct Links integration', () => {
  beforeEach(() => {
    closeInSiteDownload()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    closeInSiteDownload()
  })

  it('builds valid movie, episode, and whole-season API URLs', () => {
    expect(buildVidsrcDownloadApiUrl({ id: '786892', mediaType: 'movie' })).toBe(
      'https://dl.vidsrc.party/api/download/movie/786892',
    )

    expect(
      buildVidsrcDownloadApiUrl({
        id: 'tt0903747',
        mediaType: 'tv',
        season: 1,
        episode: 2,
        format: 'mkv',
        sub: 'en',
      }),
    ).toBe('https://dl.vidsrc.party/api/download/tv/tt0903747/1/2?format=mkv&sub=en')

    expect(
      buildVidsrcDownloadApiUrl({
        id: '1396',
        mediaType: 'anime',
        season: 1,
        audio: 'dub',
      }),
    ).toBe('https://dl.vidsrc.party/api/download/tv/1396/1?audio=dub')
  })

  it('renders Direct Links tab, MP4/MKV toggle, qualities, subtitles, and whole season', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('season=1') && !url.includes('episode=')) {
        return {
          ok: true,
          json: async () => ({
            episodes: [
              {
                episode: 1,
                title: 'Pilot',
                mp4: 'https://dl.vidsrc.party/download/tv/1396/1/1',
                mkv: 'https://dl.vidsrc.party/download/tv/1396/1/1?format=mkv',
              },
            ],
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          media: { tmdbId: 1396, title: 'Breaking Bad', type: 'tv' },
          downloads: [
            {
              quality: '1080p',
              sizeLabel: '1.42 GB',
              videoCodec: 'avc1.640028',
              mp4: 'https://dl.vidsrc.party/download/tv/1396/1/1?quality=1080p',
              mkv: 'https://dl.vidsrc.party/download/tv/1396/1/1?quality=1080p&format=mkv',
            },
          ],
          subtitles: [
            {
              label: 'English',
              lang: 'en',
              srt: 'https://dl.vidsrc.party/dash-proxy/sub/en.srt',
            },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<DownloadEmbedModal />)

    act(() => {
      openInSiteDownload({
        url: 'https://02moviedownloader.site/api/download/tv/1396/1/1',
        tmdbId: 1396,
        mediaType: 'tv',
        season: 1,
        episode: 1,
        title: 'Breaking Bad',
        subtitle: 'Season 1 · Episode 1',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('1080p')).toBeInTheDocument()
      expect(screen.getByText('1.42 GB')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /Download MP4/i })).toHaveAttribute(
        'href',
        'https://dl.vidsrc.party/download/tv/1396/1/1?quality=1080p',
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'MKV' }))
    expect(screen.getByRole('link', { name: /Download MKV/i })).toHaveAttribute(
      'href',
      'https://dl.vidsrc.party/download/tv/1396/1/1?quality=1080p&format=mkv',
    )

    fireEvent.click(screen.getByRole('button', { name: /Load Whole Season 1/i }))
    await waitFor(() => {
      expect(screen.getByText(/Season 1 Episodes \(1\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Ep 1 · Pilot/i)).toBeInTheDocument()
    })
  })
})
