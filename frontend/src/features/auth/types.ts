/** Mirrors the backend's CurrentUserResponse (docs/api.md §2.1). */
export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  onboardingCompleted: boolean;
  /** Set only for a "Try the demo" account: when it and its data will be deleted (ISO instant). */
  demoExpiresAt: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}
