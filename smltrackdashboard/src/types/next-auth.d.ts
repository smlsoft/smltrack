import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      userId?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan?: "free" | "pro";
      setupComplete?: boolean;
    };
  }
}
