import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Alert,
  Select,
  Box,
  Anchor,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import classes from './Authentication.module.css';

interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  role: 'STUDENT' | 'TEACHER';
  firstName?: string;
  lastName?: string;
}

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'TEACHER', label: 'Teacher' },
] as const;

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { redirectTo?: string } | null)?.redirectTo ?? null;
  const { login, register, isAuthenticated, user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT',
    firstName: '',
    lastName: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (redirectTo) {
        navigate(redirectTo);
      } else if (user.role === 'TEACHER') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    }
  }, [isAuthenticated, user, navigate, redirectTo]);

  const handleInputChange = useCallback(
    (field: keyof AuthFormData, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
      if (error) setError('');
      if (successMessage) setSuccessMessage('');
    },
    [error, successMessage]
  );

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return false;
    }

    if (!isLogin) {
      if (!formData.firstName || !formData.lastName) {
        setError('First name and last name are required');
        return false;
      }

      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setShowValidation(true);

    if (!validateForm()) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        const fullName = `${formData.firstName?.trim()} ${formData.lastName?.trim()}`;
        await register(formData.email, formData.password, fullName, formData.role);
        setIsLogin(true);
        setSuccessMessage('Account created successfully! Please log in.');
        setFormData({
          email: formData.email,
          password: '',
          confirmPassword: '',
          role: 'STUDENT',
          firstName: '',
          lastName: '',
        });
        setShowValidation(false);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setError('');
    setSuccessMessage('');
    setShowValidation(false);
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      role: 'STUDENT',
      firstName: '',
      lastName: '',
    });
  }, []);

  return (
    <Box className={classes.authContainer}>
      <Container size={460} w="100%">
        <Stack gap="lg">
          <Box className={classes.authHeader}>
            <Title order={1} size={48} fw={700} mb={8} className={classes.logo}>
              ALEXIDE
            </Title>
            <Text size="md" className={classes.tagline}>
              Collaborative Programming Education Platform
            </Text>
          </Box>

          <Paper p="xl" radius="lg" className={classes.authCard}>
            <Stack gap="md">
              <div>
                <Title order={2} size={28} mb={8}>
                  {isLogin ? 'Welcome Back' : 'Create Account'}
                </Title>
                <Text c="dimmed" size="sm">
                  {isLogin
                    ? 'Sign in to continue to your workspace'
                    : 'Join ALEXIDE to start coding'}
                </Text>
              </div>

              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" radius="md">
                  {error}
                </Alert>
              )}

              {successMessage && (
                <Alert icon={<IconCheck size={16} />} color="green" variant="light" radius="md">
                  {successMessage}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  {!isLogin && (
                    <Group grow>
                      <TextInput
                        label="First Name"
                        placeholder="John"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        disabled={loading}
                        withAsterisk={showValidation}
                        error={showValidation && !formData.firstName ? 'Required' : undefined}
                        radius="md"
                      />
                      <TextInput
                        label="Last Name"
                        placeholder="Smith"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        disabled={loading}
                        withAsterisk={showValidation}
                        error={showValidation && !formData.lastName ? 'Required' : undefined}
                        radius="md"
                      />
                    </Group>
                  )}

                  {!isLogin && (
                    <Select
                      label="I am a"
                      value={formData.role}
                      onChange={(value) =>
                        handleInputChange('role', value as 'STUDENT' | 'TEACHER')
                      }
                      data={ROLE_OPTIONS}
                      disabled={loading}
                      withAsterisk={showValidation}
                      radius="md"
                    />
                  )}

                  <TextInput
                    label="Email Address"
                    placeholder="your@email.com"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={loading}
                    withAsterisk={showValidation}
                    error={showValidation && !formData.email ? 'Required' : undefined}
                    radius="md"
                  />

                  <PasswordInput
                    label="Password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    disabled={loading}
                    withAsterisk={showValidation}
                    error={showValidation && !formData.password ? 'Required' : undefined}
                    radius="md"
                  />

                  {!isLogin && (
                    <PasswordInput
                      label="Confirm Password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      disabled={loading}
                      withAsterisk={showValidation}
                      error={
                        showValidation &&
                        formData.password !== formData.confirmPassword &&
                        formData.confirmPassword
                          ? 'Passwords must match'
                          : undefined
                      }
                      radius="md"
                    />
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    size="md"
                    mt="sm"
                    loading={loading}
                    disabled={loading}
                    radius="md"
                  >
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </Stack>
              </form>

              <Text ta="center" size="sm" c="dimmed">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  onClick={toggleMode}
                  disabled={loading}
                  fw={600}
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Anchor>
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};

export default Auth;
