import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { admin } from 'better-auth/plugins'
import { pool } from '@/lib/db'

async function countUsers() {
  const { rows } = await pool.query<{ count: string }>('select count(*)::text as count from "user"')
  return Number(rows[0]?.count ?? 0)
}

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          // Self-hosted servers are often reachable by several addresses (LAN IP, hostname).
          ...(process.env.TRUSTED_ORIGINS ?? '')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  hooks: {
    // Self-registration is only open until the first account (the administrator) exists.
    // After that, accounts are created by an administrator via the admin plugin.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email' && (await countUsers()) > 0) {
        throw new APIError('FORBIDDEN', { message: 'Регистрация закрыта. Обратитесь к администратору.' })
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const created = ctx.context.newSession?.user
      if (ctx.path === '/sign-up/email' && created) {
        await pool.query(
          `update "user" set role = 'admin' where id = $1 and (select count(*) from "user") = 1`,
          [created.id],
        )
      }
    }),
  },
  plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] }), nextCookies()],
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})

export { countUsers }
