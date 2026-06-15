import {
  type CreateTodoInput,
  CreateTodoSchema,
  type Todo,
  type UpdateTodoInput,
} from "@fsbg/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { createTodo, deleteTodo, listTodos, updateTodo } from "./api";
import "./App.css";

type Filter = "all" | "active" | "completed";
const todosKey = ["todos"] as const;

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "操作に失敗しました";
}

export default function App() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [notice, setNotice] = useState("");
  const todosQuery = useQuery({ queryKey: todosKey, queryFn: listTodos });
  const todos = todosQuery.data ?? [];

  const optimisticMutation = <TVariables,>(
    mutationFn: (variables: TVariables) => Promise<unknown>,
    update: (current: Todo[], variables: TVariables) => Todo[],
    successMessage: string,
  ) =>
    useMutation({
      mutationFn,
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: todosKey });
        const previous = queryClient.getQueryData<Todo[]>(todosKey) ?? [];
        queryClient.setQueryData<Todo[]>(todosKey, update(previous, variables));
        return { previous };
      },
      onError: (error, _variables, context) => {
        queryClient.setQueryData(todosKey, context?.previous);
        setNotice(messageOf(error));
      },
      onSuccess: () => setNotice(successMessage),
      onSettled: () => queryClient.invalidateQueries({ queryKey: todosKey }),
    });

  const createMutation = optimisticMutation<CreateTodoInput>(
    createTodo,
    (current, input) => {
      const now = new Date().toISOString();
      return [
        {
          id: crypto.randomUUID(),
          title: input.title,
          description: input.description ?? "",
          completed: false,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ];
    },
    "Todoを追加しました",
  );
  const updateMutation = optimisticMutation<{
    id: string;
    input: UpdateTodoInput;
  }>(
    ({ id, input }) => updateTodo(id, input),
    (current, { id, input }) =>
      current.map((todo) =>
        todo.id === id
          ? { ...todo, ...input, updatedAt: new Date().toISOString() }
          : todo,
      ),
    "Todoを更新しました",
  );
  const deleteMutation = optimisticMutation<string>(
    deleteTodo,
    (current, id) => current.filter((todo) => todo.id !== id),
    "Todoを削除しました",
  );

  const visibleTodos = useMemo(
    () =>
      todos.filter((todo) => {
        if (filter === "active") return !todo.completed;
        if (filter === "completed") return todo.completed;
        return true;
      }),
    [filter, todos],
  );
  const remaining = todos.filter((todo) => !todo.completed).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = CreateTodoSchema.safeParse({ title, description });
    if (!result.success) {
      setNotice("タイトルは1〜100文字、説明は500文字以内で入力してください");
      return;
    }
    createMutation.mutate(result.data);
    setTitle("");
    setDescription("");
  };

  const edit = (todo: Todo) => {
    const nextTitle = window.prompt("タイトルを編集", todo.title);
    if (nextTitle === null) return;
    const nextDescription = window.prompt("説明を編集", todo.description);
    if (nextDescription === null) return;
    setEditingId(todo.id);
    updateMutation.mutate(
      {
        id: todo.id,
        input: { title: nextTitle, description: nextDescription },
      },
      { onSettled: () => setEditingId(undefined) },
    );
  };

  return (
    <main className="page-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">DAILY REGISTER / {new Date().getFullYear()}</p>
          <h1>今日の余白</h1>
          <p className="lede">やることを記し、終えたものには静かに線を引く。</p>
        </div>
        <div className="count-block" aria-label={`未完了 ${remaining}件`}>
          <strong>{String(remaining).padStart(2, "0")}</strong>
          <span>OPEN ITEMS</span>
        </div>
      </header>

      <section className="workspace" aria-label="Todo workspace">
        <form className="composer" onSubmit={submit}>
          <p className="section-label">NEW ENTRY</p>
          <label>
            やること
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="例: 設計レビューをまとめる"
            />
          </label>
          <label>
            メモ
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="背景や完了条件を書いておく"
            />
          </label>
          <button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "記録中..." : "記録する"}
          </button>
        </form>

        <section className="ledger">
          <div className="ledger-toolbar">
            <p className="section-label">ENTRIES / {todos.length}</p>
            <div className="filters" aria-label="表示フィルター">
              {(["all", "active", "completed"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {{ all: "全件", active: "未完了", completed: "完了" }[value]}
                </button>
              ))}
            </div>
          </div>

          {todosQuery.isPending ? (
            <p className="state">ページを開いています...</p>
          ) : todosQuery.isError ? (
            <div className="state">
              <p>{messageOf(todosQuery.error)}</p>
              <button type="button" onClick={() => todosQuery.refetch()}>
                再試行
              </button>
            </div>
          ) : visibleTodos.length === 0 ? (
            <p className="state">ここにはまだ記録がありません。</p>
          ) : (
            <ol className="todo-list">
              {visibleTodos.map((todo, index) => (
                <li key={todo.id} className={todo.completed ? "completed" : ""}>
                  <button
                    className="check"
                    type="button"
                    aria-label={`${todo.title}を${todo.completed ? "未完了" : "完了"}にする`}
                    onClick={() =>
                      updateMutation.mutate({
                        id: todo.id,
                        input: { completed: !todo.completed },
                      })
                    }
                  >
                    {todo.completed ? "✓" : String(index + 1).padStart(2, "0")}
                  </button>
                  <div className="todo-copy">
                    <strong>{todo.title}</strong>
                    {todo.description ? <p>{todo.description}</p> : null}
                    <span>{todo.completed ? "完了" : "進行中"}</span>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      disabled={editingId === todo.id}
                      onClick={() => edit(todo)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(`「${todo.title}」を削除しますか？`)
                        ) {
                          deleteMutation.mutate(todo.id);
                        }
                      }}
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>
      <p className="notice" aria-live="polite">
        {notice}
      </p>
    </main>
  );
}
