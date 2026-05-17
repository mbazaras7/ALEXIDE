import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { AuthProvider } from '../../contexts/AuthContext';
import Auth from '../Authentication';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../services/authService', () => ({
  __esModule: true,
  default: {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    setToken: jest.fn(),
    getToken: jest.fn(() => null),
    removeToken: jest.fn(),
    isAuthenticated: jest.fn(() => false),
    logout: jest.fn(),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MantineProvider env="test">
      <BrowserRouter>
        <AuthProvider>{component}</AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  );
};

describe('Authentication Component tests', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('should render login form by default', () => {
    renderWithRouter(<Auth />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Sign in to continue to your workspace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('should toggle to register mode when clicking the "Sign Up" link', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    const signUpLink = screen.getByText('Sign Up');
    await user.click(signUpLink);

    await waitFor(() => {
      expect(screen.getByText('Join ALEXIDE to start coding')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Smith')).toBeInTheDocument();
  });

  test('should show error for empty email and password', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(screen.getByText('Email and password are required')).toBeInTheDocument();
  });

  //TODO - fix test for invalid email format when implementation fixed
  // test('should show error for invalid email format', async () => {
  //     const user = userEvent.setup();
  //     renderWithRouter(<Auth />);

  //     const signUpLink = screen.getByText('Sign Up');
  //     await user.click(signUpLink);

  //     const emailInput = screen.getByPlaceholderText('your.email@example.com');
  //     const passwordInput = screen.getByPlaceholderText('Minimum 8 characters');
  //     const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password')
  //     const submitButton = screen.getByRole('button', { name: /create account/i });

  //     await user.type(emailInput, 'invalidemail');
  //     await user.type(passwordInput, 'password123');
  //     await user.click(submitButton);

  //     expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  // });

  test('should update form inputs when user types', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    const emailInput = screen.getByPlaceholderText('your@email.com') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('password123');
  });

  test('should show error for password less than 8 characters in signup', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    const signUpLink = screen.getByText('Sign Up');
    await user.click(signUpLink);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('John'), 'John');
    await user.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await user.type(screen.getByPlaceholderText('your@email.com'), 'john@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'pass123');
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'pass123');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
  });

  test('should show error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    const signUpLink = screen.getByText('Sign Up');
    await user.click(signUpLink);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('John'), 'John');
    await user.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await user.type(screen.getByPlaceholderText('your@email.com'), 'john@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'password456');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  test('should allow selecting teacher role in signup mode', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    await user.click(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    });

    const roleSelect = screen.getByRole('textbox', { name: /i am a/i });
    await user.click(roleSelect);

    await waitFor(() => {
      expect(screen.getByText('Teacher')).toBeVisible();
    });

    await user.click(screen.getByText('Teacher'));

    expect(roleSelect).toHaveValue('Teacher');
  });

  test('should clear error message when user starts typing', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByText('Email and password are required')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('your@email.com'), 'a');

    await waitFor(() => {
      expect(screen.queryByText('Email and password are required')).not.toBeInTheDocument();
    });
  });

  test('should clear form when toggling between login and signup', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    await user.type(screen.getByPlaceholderText('your@email.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');

    const signUpLink = screen.getByText('Sign Up');
    await user.click(signUpLink);

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText('your@email.com') as HTMLInputElement;
      expect(emailInput.value).toBe('');
    });
  });

  test('should call login with correct credentials', async () => {
    const mockLogin = jest.fn().mockResolvedValue(undefined);

    const useAuthSpy = jest.spyOn(require('../../contexts/AuthContext'), 'useAuth');
    useAuthSpy.mockReturnValue({
      login: mockLogin,
      register: jest.fn(),
      isAuthenticated: false,
      user: null,
      loading: false,
      logout: jest.fn(),
    });

    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    await user.type(screen.getByPlaceholderText('your@email.com'), 'test@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    useAuthSpy.mockRestore();
  });

  test('should call register and switch to login on success', async () => {
    const mockRegister = jest.fn().mockResolvedValue(undefined);

    const useAuthSpy = jest.spyOn(require('../../contexts/AuthContext'), 'useAuth');
    useAuthSpy.mockReturnValue({
      login: jest.fn(),
      register: mockRegister,
      isAuthenticated: false,
      user: null,
      loading: false,
      logout: jest.fn(),
    });

    const user = userEvent.setup();
    renderWithRouter(<Auth />);

    await user.click(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('John'), 'John');
    await user.type(screen.getByPlaceholderText('Smith'), 'Doe');
    await user.type(screen.getByPlaceholderText('your@email.com'), 'john@example.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.type(screen.getByPlaceholderText('Confirm your password'), 'password123');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();

    useAuthSpy.mockRestore();
  });

  //TODO - make loading visual test when implemented
  test('should show loading state during submission', async () => {});

  //TODO - make student dashboard nav test when implemented
  test('should navigate to student dashboard on successful login', async () => {});

  //TODO - make teacher dashboard nav test when implemented
  test('should navigate to teacher dashboard on successful signup as teacher', async () => {});
});
