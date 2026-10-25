import { render, screen } from '@testing-library/react'
import { App } from './App'

test('renders the import page by default', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /swipie/i })).toBeInTheDocument()
})
