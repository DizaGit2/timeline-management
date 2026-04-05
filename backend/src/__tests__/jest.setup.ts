// Set strong test JWT secrets before any module (including config.ts) is imported.
// This ensures startup validation passes in the test environment.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-jwt-secret-not-used-in-production-32x";
process.env.JWT_REFRESH_SECRET =
  "test-only-refresh-secret-not-used-in-production-32x";
