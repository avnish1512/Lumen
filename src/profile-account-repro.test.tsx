import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const currentUserKey = 'omdb.apple-tv-style.current-user'
const profilesListKey = 'omdb.apple-tv-style.profiles-list'

function seedSignedInUser() {
  const user = {
    name: 'Avnish',
    email: 'avnishpc00@gmail.com',
    avatarColor: 'red',
  }
  window.localStorage.setItem(currentUserKey, JSON.stringify(user))
  window.localStorage.setItem(
    `${profilesListKey}.${user.email}`,
    JSON.stringify([
      { name: 'Avnish', avatarColor: 'red' },
      { name: 'Children', avatarColor: 'kids' },
    ]),
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: false,
    json: () => Promise.resolve({}),
  })))
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.location.hash = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('profile and account routes', () => {
  it('renders the signed-in account screen', async () => {
    seedSignedInUser()
    window.location.hash = '#login'

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Account' })).toBeInTheDocument()
  })

  it('renders the profile chooser screen', async () => {
    seedSignedInUser()
    window.location.hash = '#profiles'

    render(<App />)

    expect(await screen.findByRole('heading', { name: "Who's watching?" })).toBeInTheDocument()
  })
})
