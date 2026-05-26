"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { authUser, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && authUser) router.replace("/dashboard/");
  }, [authUser, loading, router]);

  async function handleGoogle() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(action: "signin" | "signup") {
    if (!email || !password) {
      toast.error("Введіть email і пароль");
      return;
    }
    setBusy(true);
    try {
      if (action === "signin") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
    } catch (e) {
      toast.error(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-purple-50 px-4 py-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mb-6 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="h-16 w-16 rounded-2xl shadow-lg"
        />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">ЛавандаОблік</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Увійдіть, щоб продовжити
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 pt-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon className="mr-2 h-4 w-4" />
            )}
            Увійти через Google
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              або email
            </span>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Вхід</TabsTrigger>
              <TabsTrigger value="signup">Реєстрація</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3 pt-3">
              <EmailForm
                email={email}
                password={password}
                setEmail={setEmail}
                setPassword={setPassword}
              />
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={() => handleEmail("signin")}
                disabled={busy}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Увійти
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 pt-3">
              <EmailForm
                email={email}
                password={password}
                setEmail={setEmail}
                setPassword={setPassword}
              />
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={() => handleEmail("signup")}
                disabled={busy}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Створити акаунт
              </Button>
              <p className="text-xs text-muted-foreground">
                Перший зареєстрований користувач отримує права адміністратора.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}

function EmailForm({
  email,
  password,
  setEmail,
  setPassword,
}: {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
    </>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC04"
        d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.53 1 10.22 1 12s.43 3.47 1.18 4.96l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function messageFor(e: unknown): string {
  const err = e as { code?: string; message?: string };
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Невірний email або пароль";
    case "auth/email-already-in-use":
      return "Такий email уже зареєстровано";
    case "auth/weak-password":
      return "Пароль закороткий (мін. 6 символів)";
    case "auth/popup-closed-by-user":
      return "Вікно входу закрито";
    case "auth/network-request-failed":
      return "Проблема з мережею";
    default:
      return err?.message ?? "Невідома помилка";
  }
}
