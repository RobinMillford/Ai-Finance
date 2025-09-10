import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
});

export const config = {
  matcher: [
    /*
     * Protect all routes except the specified public ones
     * Public routes:
     * - /choose-market
     * - /news
     * - /stocks
     * - /forexs
     * - /cryptos
     */
    '/((?!choose-market$|news$|stocks$|forexs$|cryptos$|api|_next/static|_next/image|favicon.ico|auth).*)',
  ]
};