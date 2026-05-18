export const AuthTab = {
  Login: 'login',
  Register: 'register',
} as const;

export type AuthTab = (typeof AuthTab)[keyof typeof AuthTab];
