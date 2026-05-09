import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders sudoku title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Sudoku/i);
  expect(titleElement).toBeInTheDocument();
});
