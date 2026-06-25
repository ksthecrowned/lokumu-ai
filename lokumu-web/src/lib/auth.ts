import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: clientId || '',
      clientSecret: clientSecret || '',
    }),
    // Credentials provider for demo purposes
    Credentials({
      name: 'Demo',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "demo" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Demo login - accept any credentials for demo purposes
        // In production, you would validate against a database
        if (credentials?.username === 'demo' && credentials?.password === 'demo') {
          return {
            id: 'demo-user',
            name: 'Demo User',
            email: 'demo@example.com',
          };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async session({ session, token }: any) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

export type Session = {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  expires?: string;
};