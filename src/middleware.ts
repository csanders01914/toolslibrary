import { auth } from "./auth.config";

export default auth((req) => {
  // Force password change: a session flagged mustChangePassword (stock seeded
  // credentials) is locked out of every route until the password is replaced.
  const mustChangePassword = req.auth?.user?.mustChangePassword === true;
  const { pathname } = req.nextUrl;

  if (mustChangePassword && pathname !== "/change-password") {
    return Response.redirect(new URL("/change-password", req.nextUrl));
  }

  // Route protection is handled in authConfig.callbacks.authorized
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};