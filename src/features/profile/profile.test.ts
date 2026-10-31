import { describe, expect, it } from 'vitest'
import { cardPhoto, photoSourceOf } from '@/features/profile/api'
import { cropSquare, MAX_ZOOM } from '@/features/profile/avatar'

const user = { photoURL: 'https://lh3.googleusercontent.com/a/laura' }
const avatar = { publicId: 'pbl/prod/users/u1/avatar', version: 1730000000 }

describe('profile photo (M11)', () => {
  it('reads profiles saved before M11 from showPhoto', () => {
    expect(photoSourceOf(null)).toBe('google')
    expect(photoSourceOf({ showPhoto: true })).toBe('google')
    expect(photoSourceOf({ showPhoto: false })).toBe('initials')
    expect(photoSourceOf({ showPhoto: false, photoSource: 'upload' })).toBe(
      'upload',
    )
  })

  it('puts the chosen photo on the cards', () => {
    expect(cardPhoto(user, null)).toBe(user.photoURL)
    expect(cardPhoto(user, { photoSource: 'initials' })).toBeNull()
    expect(cardPhoto({ photoURL: null }, { photoSource: 'google' })).toBeNull()
    const uploaded = cardPhoto(user, { photoSource: 'upload', avatar })
    expect(uploaded).toMatch(
      /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/f_auto,q_auto,c_fill,w_256,h_256\/v1730000000\/pbl\/prod\/users\/u1\/avatar$/,
    )
    // "my photo" without one yet → Google's
    expect(cardPhoto(user, { photoSource: 'upload', avatar: null })).toBe(
      user.photoURL,
    )
  })

  it('crops the centered largest square by default', () => {
    expect(cropSquare(400, 300, 1, 0, 0)).toEqual({ sx: 50, sy: 0, size: 300 })
    expect(cropSquare(300, 400, 1, 0, 0)).toEqual({ sx: 0, sy: 50, size: 300 })
  })

  it('zooms in and moves within the picture, never outside it', () => {
    expect(cropSquare(400, 400, 2, 0, 0)).toEqual({
      sx: 100,
      sy: 100,
      size: 200,
    })
    expect(cropSquare(400, 400, 2, -1, 1)).toEqual({
      sx: 0,
      sy: 200,
      size: 200,
    })
    // out of range values are clamped
    expect(cropSquare(400, 400, 2, -5, 5)).toEqual({
      sx: 0,
      sy: 200,
      size: 200,
    })
    expect(cropSquare(400, 400, 99, 0, 0).size).toBe(400 / MAX_ZOOM)
    expect(cropSquare(400, 400, 0.1, 0, 0).size).toBe(400)
  })
})
