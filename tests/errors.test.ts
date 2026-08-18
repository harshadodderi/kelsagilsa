import { describe, expect, it } from 'vitest'
import { isThrottle, userFacingMessage } from '@/lib/errors'

describe('throttles are rendered, never swallowed (§6.4)', () => {
  it('shows the database message for a throttle', () => {
    const error = {
      code: 'KG002',
      message: 'You can add 2 reports a day without a booking. Please come back tomorrow.',
    }
    expect(isThrottle(error)).toBe(true)
    expect(userFacingMessage(error, 'Something went wrong.')).toBe(error.message)
  })

  it('never shows a permission error to a user', () => {
    // A column-grant denial is the privacy layer working (§3.1). It is a bug
    // in the caller, not something to explain to the person at the keyboard.
    const error = { code: '42501', message: 'permission denied for column phone' }
    expect(userFacingMessage(error, 'Something went wrong.')).toBe('Something went wrong.')
  })
})
