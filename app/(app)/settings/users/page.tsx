"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthContext";
import { listUsers, updateUserRole } from "@/lib/data/users";
import type { Role, UserDoc } from "@/lib/data/types";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Адміністратор",
  seller: "Продавець",
  viewer: "Перегляд",
};

const ROLE_VARIANTS: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  seller: "secondary",
  viewer: "outline",
};

export default function UsersSettingsPage() {
  const router = useRouter();
  const { authUser, userDoc, loading } = useAuth();
  const [users, setUsers] = useState<UserDoc[] | null>(null);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const isAdmin = userDoc?.role === "admin";

  useEffect(() => {
    if (!loading && !isAdmin) router.replace("/settings/");
  }, [loading, isAdmin, router]);

  const refresh = useCallback(async () => {
    try {
      const list = await listUsers();
      setUsers(list);
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Не вдалось завантажити користувачів");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin, refresh]);

  async function handleRoleChange(uid: string, newRole: Role) {
    setSavingUid(uid);
    try {
      await updateUserRole(uid, newRole);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)) : prev
      );
      toast.success("Роль оновлено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Не вдалось оновити роль");
    } finally {
      setSavingUid(null);
    }
  }

  if (loading || !isAdmin) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </main>
    );
  }

  return (
    <main className="container mx-auto flex flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Користувачі</h1>
        <p className="text-sm text-muted-foreground">
          Всі акаунти, що зареєструвалися. Змінюйте роль, щоб дати доступ.
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          {users === null ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Жодного користувача поки немає.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Користувач</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Зареєстровано
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.uid === authUser?.uid;
                  return (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">
                        {u.name || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant={ROLE_VARIANTS[u.role]}>
                            {ROLE_LABELS[u.role]} · ви
                          </Badge>
                        ) : (
                          <Select
                            value={u.role}
                            onValueChange={(v) =>
                              handleRoleChange(u.uid, v as Role)
                            }
                            disabled={savingUid === u.uid}
                          >
                            <SelectTrigger className="h-8 w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                {ROLE_LABELS.admin}
                              </SelectItem>
                              <SelectItem value="seller">
                                {ROLE_LABELS.seller}
                              </SelectItem>
                              <SelectItem value="viewer">
                                {ROLE_LABELS.viewer}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                        {formatDate(u.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function formatDate(ts: UserDoc["createdAt"]): string {
  if (!ts) return "—";
  const d = ts.toDate();
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
