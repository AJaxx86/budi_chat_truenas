import { createContext, useContext } from 'react';

export const AuthContext = createContext({
  user: null,
  setUser: () => { },
  login: () => { },
  logout: () => { },
  isMaster: () => false,
  isAdmin: () => false
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
