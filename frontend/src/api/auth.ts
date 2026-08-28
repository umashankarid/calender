import type { TokenResponse, User } from '../types';
import { apiGet, apiPost } from './client';

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse> {
  return apiPost<TokenResponse>('/api/auth/login', { email, password });
}

export async function register(
  email: string,
  name: string,
  password: string,
): Promise<TokenResponse> {
  return apiPost<TokenResponse>('/api/auth/register', {
    email,
    name,
    password,
  });
}

export async function getMe(token: string): Promise<User> {
  return apiGet<User>('/api/auth/me', token);
}
