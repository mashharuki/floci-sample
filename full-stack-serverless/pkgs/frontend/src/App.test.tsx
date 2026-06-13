import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import * as api from "./api";

vi.mock("./api");

const todo = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "設計レビュー",
  description: "API境界を確認",
  completed: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}

describe("Todo UI", () => {
  beforeEach(() => {
    vi.mocked(api.listTodos).mockResolvedValue([todo]);
    vi.mocked(api.createTodo).mockResolvedValue(todo);
    vi.mocked(api.updateTodo).mockResolvedValue(todo);
    vi.mocked(api.deleteTodo).mockResolvedValue();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "prompt",
      vi.fn(() => "更新済み"),
    );
    vi.stubGlobal("crypto", { randomUUID: () => todo.id });
  });

  test("loads, filters, and shows empty filtered state", async () => {
    renderApp();
    expect(await screen.findByText("設計レビュー")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(
      screen.getByText("ここにはまだ記録がありません。"),
    ).toBeInTheDocument();
  });

  test("creates and optimistically toggles a todo", async () => {
    vi.mocked(api.createTodo).mockImplementation(
      () => new Promise(() => undefined),
    );
    renderApp();
    await screen.findByText("設計レビュー");
    await userEvent.type(screen.getByLabelText("やること"), "新しいTodo");
    await userEvent.click(screen.getByRole("button", { name: "記録する" }));
    expect(screen.getByText("新しいTodo")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "設計レビューを完了にする" }),
    );
    await waitFor(() => expect(api.updateTodo).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    await waitFor(() =>
      expect(api.updateTodo).toHaveBeenCalledWith(todo.id, {
        title: "更新済み",
        description: "更新済み",
      }),
    );
  });

  test("rolls back a failed deletion and supports retry", async () => {
    vi.mocked(api.deleteTodo).mockRejectedValueOnce(new Error("削除失敗"));
    renderApp();
    await screen.findByText("設計レビュー");
    await userEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(await screen.findByText("削除失敗")).toBeInTheDocument();
    expect(screen.getByText("設計レビュー")).toBeInTheDocument();
  });
});
