import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface UserProfile {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };
}

//Authentication service class to handle api requests for the frontend
class AuthService {
  private api = axios.create({
    baseURL: `${API_BASE_URL}/api/backend/auth`,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  //Constructor to add token in header to the requests
  constructor() {
    this.api.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  //register request, doesn't return token
  async register(
    data: RegisterRequest
  ): Promise<{ success: boolean; message?: string; data?: unknown }> {
    const response = await this.api.post('/register', data);
    return response.data;
  }

  //login request, returns token
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.api.post('/login', data);
    const token = response.data.data.token;
    const user = response.data.data.user;

    if (token) {
      this.setToken(token);
    }

    return { token, user };
  }

  async getProfile(): Promise<UserProfile> {
    const response = await this.api.get('/me');
    return response.data;
  }

  async updateProfile(name: string): Promise<UserProfile> {
    const response = await this.api.put('/me', { name });
    return response.data;
  }

  //Token management, using local storage for now, might change as not most secure
  setToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  removeToken(): void {
    localStorage.removeItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    this.removeToken();
  }
}

const authService = new AuthService();
export default authService;
