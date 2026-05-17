import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import HomePage from '../HomePage';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      <BrowserRouter>{component}</BrowserRouter>
    </MantineProvider>
  );
};

describe('HomePage Component tests', () => {
  test('should render the main heading and description', () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByText(/ALEXIDE/i)).toBeInTheDocument();
    expect(screen.getByText(/collaborative web-based IDE/i)).toBeInTheDocument();
  });

  test('should have a link to authentication page', () => {
    renderWithProviders(<HomePage />);

    const link = screen.getByRole('link', { name: /get started/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/auth');
  });

  test('should render all three feature cards', () => {
    renderWithProviders(<HomePage />);

    expect(screen.getByText('Real-time Coding')).toBeInTheDocument();
    expect(screen.getByText('Collaborate')).toBeInTheDocument();
    expect(screen.getByText('Store Your Projects')).toBeInTheDocument();
  });
});
