"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";

const PASSWORD_MIN = 7;

export default function LoginPage() {
  const router = useRouter();
  const { authUser, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  // Спільні поля
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Поля лише для signup
  const [fullName, setFullName] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaState>(() => newCaptcha());
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && authUser) {
      // На мобільному найчастіше створюють замовлення — лендимо одразу туди.
      // Desktop за замовчуванням стартує з дашборду з графіками.
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches;
      router.replace(isMobile ? "/orders/" : "/dashboard/");
    }
  }, [authUser, loading, router]);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(newCaptcha());
    setCaptchaAnswer("");
  }, []);

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

  async function handleSignIn() {
    if (!email || !password) {
      toast.error("Введіть email і пароль");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      toast.error(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp() {
    const name = fullName.trim();
    if (!name) {
      toast.error("Вкажіть ФІО");
      return;
    }
    if (!email) {
      toast.error("Введіть email");
      return;
    }
    if (password.length < PASSWORD_MIN) {
      toast.error(`Пароль має бути не менше ${PASSWORD_MIN} символів`);
      return;
    }
    if (Number(captchaAnswer) !== captcha.answer) {
      toast.error("Невірна відповідь на каптчу");
      refreshCaptcha();
      return;
    }
    setBusy(true);
    try {
      await signUpWithEmail(email, password, name);
    } catch (e) {
      toast.error(messageFor(e));
      refreshCaptcha();
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
              <EmailField
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={handleSignIn}
                disabled={busy}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Увійти
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label htmlFor="fullName">ФІО</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Іваненко Іван Іванович"
                />
              </div>
              <EmailField
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <PasswordField
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                hint={`Мінімум ${PASSWORD_MIN} символів`}
              />
              <CaptchaField
                captcha={captcha}
                answer={captchaAnswer}
                onChange={setCaptchaAnswer}
                onRefresh={refreshCaptcha}
              />
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={handleSignUp}
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

function EmailField({
  value,
  onChange,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="password">Пароль</Label>
      <Input
        id="password"
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type CaptchaState = { a: number; b: number; answer: number };

function newCaptcha(): CaptchaState {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

function CaptchaField({
  captcha,
  answer,
  onChange,
  onRefresh,
}: {
  captcha: CaptchaState;
  answer: string;
  onChange: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="captcha">
        Скільки буде {captcha.a} + {captcha.b}?
      </Label>
      <div className="flex gap-2">
        <Input
          id="captcha"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))}
          placeholder="?"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRefresh}
          aria-label="Оновити каптчу"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
      return `Пароль закороткий (мін. ${PASSWORD_MIN} символів)`;
    case "auth/popup-closed-by-user":
      return "Вікно входу закрито";
    case "auth/network-request-failed":
      return "Проблема з мережею";
    default:
      return err?.message ?? "Невідома помилка";
  }
}
