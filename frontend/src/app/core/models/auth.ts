export interface User {
  id: number;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/** Returned by login and password change. */
export interface Session {
  token: string;
  /** ISO timestamp after which the token is rejected. */
  expiresAt: string;
  user: User;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Which sign-in methods the login page offers (GET /api/auth/options). */
export interface AuthOptions {
  /** Empty when Google sign-in is off. */
  googleClientId: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
