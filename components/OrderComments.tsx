"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  addComment,
  deleteComment,
  listComments,
} from "@/lib/data/comments";
import { formatDateLong, tsToDate } from "@/lib/utils/format";
import type { OrderComment } from "@/lib/data/types";

export function OrderComments({ orderId }: { orderId: string }) {
  const { authUser, userDoc } = useAuth();
  const [comments, setComments] = useState<OrderComment[] | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listComments(orderId);
      setComments(list);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось завантажити коментарі");
    }
  }, [orderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAdd() {
    if (!authUser) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      toast.error("Коментар не може бути довшим за 2000 символів");
      return;
    }
    setSubmitting(true);
    try {
      const authorName =
        userDoc?.name || authUser.displayName || authUser.email || null;
      await addComment(orderId, trimmed, authUser.uid, authorName);
      setText("");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось додати коментар");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(c: OrderComment) {
    if (!window.confirm("Видалити коментар?")) return;
    try {
      await deleteComment(orderId, c.id);
      setComments((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
    } catch (e) {
      console.error(e);
      toast.error("Не вдалось видалити");
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-card/50 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MessageSquare className="h-4 w-4" />
        Коментарі{comments ? ` (${comments.length})` : ""}
      </div>

      {comments === null ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Поки що жодного коментаря.
        </p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => {
            const createdAt = tsToDate(c.createdAt);
            const isMine = c.authorUid === authUser?.uid;
            return (
              <li
                key={c.id}
                className="space-y-1 rounded-md border bg-background p-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-medium">
                      {c.authorName ?? c.authorUid}
                    </span>
                    {createdAt && (
                      <span className="ml-2 text-muted-foreground">
                        {formatDateLong(createdAt)}
                      </span>
                    )}
                  </div>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Видалити коментар"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm">{c.text}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 pt-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Написати коментар…"
          rows={2}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={submitting || !text.trim()}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {submitting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-3.5 w-3.5" />
            )}
            Надіслати
          </Button>
        </div>
      </div>
    </div>
  );
}
