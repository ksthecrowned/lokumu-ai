# NextAuth.js Google OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google OAuth authentication to Lokumu Web frontend using NextAuth.js v5.

**Architecture:** NextAuth.js App Router integration with JWT session, protected chat route.

---

## Phase 1: Dependencies

### Task 1: Install NextAuth.js

**Files:**
- Modify: `lokumu-web/package.json`

- [ ] **Step 1: Install next-auth and dependencies**
```bash
cd lokumu-web
npm install next-auth @auth/core
```

- [ ] **Step 2: Verify installation**

---

## Phase 2: Auth Configuration

### Task 2: Auth Route and Config

**Files:**
- Create: `lokumu-web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `lokumu-web/src/lib/auth.ts`
- Create: `lokumu-web/src/lib/auth-provider.tsx`

- [ ] **Step 1: Create NextAuth configuration with Google provider**

```typescript
// lokumu-web/src/lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Create auth route handler**

```typescript
// lokumu-web/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Create env.example for Google credentials**

- [ ] **Step 4: Test auth configuration**

---

## Phase 3: Protected Routes

### Task 3: Auth Context and Protected Chat

**Files:**
- Create: `lokumu-web/src/components/auth/login-button.tsx`
- Modify: `lokumu-web/src/app/(chat)/page.tsx`

- [ ] **Step 1: Create LoginButton component**

- [ ] **Step 2: Protect chat page with auth**

- [ ] **Step 3: Add logout functionality**

- [ ] **Step 4: Test protected route**