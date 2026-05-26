"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deleteUserDoc, listUsers, updateUserRole } from "@/lib/data/users";
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

  async function handleReject(uid: string, email: string) {
    if (
      !window.confirm(
        `Відхилити заявку від ${email}? Запис буде видалено, але користувач зможе подати заявку ще раз.`
      )
    ) {
      return;
    }
    setSavingUid(uid);
    try {
      await deleteUserDoc(uid);
      setUsers((prev) => (prev ? prev.filter((u) => u.uid !== uid) : prev));
      toast.success("Заявку відхилено");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err?.message ?? "Не вдалось відхилити заявку");
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
          Нові заявки на доступ помічено «Очікує» — затвердіть або відхиліть.
          Активним акаунтам можна змінити роль будь-коли.
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
                        ) : u.role === "viewer" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-700 dark:text-amber-400"
                            >
                              Очікує
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  disabled={savingUid === u.uid}
                                >
                                  Затвердити
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleRoleChange(u.uid, "admin")
                                  }
                                >
                                  {ROLE_LABELS.admin}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleRoleChange(u.uid, "seller")
                                  }
                                >
                                  {ROLE_LABELS.seller}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleReject(u.uid, u.email)}
                              disabled={savingUid === u.uid}
                            >
                              Відхилити
                            </Button>
                          </div>
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
