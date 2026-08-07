import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function Login() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-2xl font-black text-[#315c3b]">NongQing AI Yu</Link>
        <section className="surface p-6 md:p-8">
          <h1 className="text-3xl font-black">Welcome back</h1>
          <p className="mb-6 text-stone-600">Log in to continue managing your farm records.</p>
          <AuthForm mode="login"/>
        </section>
      </div>
    </main>
  );
}
