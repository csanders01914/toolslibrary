import { auth } from "./auth.config";

export default auth((req) => {
  // Middleware logic is handled in authConfig.callbacks.authorized
  // This wrapper ensures the auth function runs on every request
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};