import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import Terminal from '../Terminal';

jest.mock('@xterm/xterm', () => ({
  Terminal: jest.fn().mockImplementation(() => ({
    open: jest.fn(),
    write: jest.fn(),
    writeln: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
    onData: jest.fn(),
    onResize: jest.fn(),
    cols: 80,
    rows: 24,
    loadAddon: jest.fn(),
  })),
}));

jest.mock('@xterm/addon-fit', () => ({
  FitAddon: jest.fn().mockImplementation(() => ({
    fit: jest.fn(),
    activate: jest.fn(),
  })),
}));

jest.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: jest.fn().mockImplementation(() => ({
    activate: jest.fn(),
  })),
}));

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

const renderComponent = (props = {}) =>
  render(
    <MantineProvider>
      <Terminal isVisible={true} {...props} />
    </MantineProvider>
  );

describe('Terminal Component tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('authToken', 'test-token');
  });

  afterEach(() => localStorage.clear());

  test('should render Terminal header text', () => {
    renderComponent();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  test('should render clear button', () => {
    renderComponent();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('should render when isVisible is true', () => {
    renderComponent({ isVisible: true });
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  test('should attempt socket connection with auth token', () => {
    const { io } = require('socket.io-client');
    localStorage.setItem('authToken', 'my-token');
    renderComponent();
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: 'my-token' } })
    );
  });

  test('should not attempt socket connection without auth token', () => {
    const { io } = require('socket.io-client');
    localStorage.removeItem('authToken');
    renderComponent();
    expect(io).not.toHaveBeenCalled();
  });

  test('should call clear on the xterm instance when clear button clicked', async () => {
    const { Terminal: MockXTerm } = require('@xterm/xterm');
    const mockClear = jest.fn();
    MockXTerm.mockImplementation(() => ({
      open: jest.fn(),
      write: jest.fn(),
      writeln: jest.fn(),
      clear: mockClear,
      dispose: jest.fn(),
      onData: jest.fn(),
      onResize: jest.fn(),
      cols: 80,
      rows: 24,
      loadAddon: jest.fn(),
    }));

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button'));
    expect(mockClear).toHaveBeenCalled();
  });
});
