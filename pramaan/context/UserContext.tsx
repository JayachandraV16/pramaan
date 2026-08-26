import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from 'react';

type User = {
  id?: string;
  name: string;
  email: string;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
};

const UserContext = createContext<
  UserContextType | undefined
>(undefined);

export function UserProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error(
      'useUser must be used inside UserProvider'
    );
  }

  return context;
}