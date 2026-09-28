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

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
