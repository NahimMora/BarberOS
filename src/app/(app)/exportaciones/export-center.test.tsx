import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportCenter } from './export-center'

const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() },
}))

describe('ExportCenter', () => {
  beforeEach(() => {
    toastError.mockClear()
    global.URL.createObjectURL = vi.fn()
  })

  it('does not trigger a download when the export request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No se pudo generar la exportación' }),
    }) as unknown as typeof fetch

    render(<ExportCenter role="admin" branches={[]} />)

    const csvButtons = screen.getAllByRole('button', { name: /csv/i })
    fireEvent.click(csvButtons[0])

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
