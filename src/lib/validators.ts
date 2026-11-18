const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: { email?: string; password?: string }) {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";

  if (!email) return { field: "email" as const, error: "Enter your work email." };
  if (!EMAIL.test(email)) {
    return { field: "email" as const, error: "Enter a valid work email." };
  }
  if (!password) return { field: "password" as const, error: "Enter your password." };
  if (password.length < 6) {
    return {
      field: "password" as const,
      error: "Password must be at least 6 characters.",
    };
  }

  return { email, password };
}
