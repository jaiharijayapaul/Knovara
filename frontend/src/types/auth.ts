export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'student' | 'instructor' | 'admin';
  education_level: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  education_level?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
