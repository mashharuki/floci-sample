import type { CreateTodoInput, Todo, UpdateTodoInput } from "@fsbg/shared";
import {
  TodoNotFoundError,
  type TodoRepository,
} from "../repositories/todo-repository.js";

export class TodoService {
  constructor(
    private readonly repository: TodoRepository,
    private readonly now = () => new Date(),
    private readonly createId: () => string = () => crypto.randomUUID(),
  ) {}

  async list(): Promise<Todo[]> {
    const todos = await this.repository.list();
    return [...todos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<Todo> {
    const todo = await this.repository.get(id);
    if (!todo) {
      throw new TodoNotFoundError(id);
    }
    return todo;
  }

  async create(input: CreateTodoInput): Promise<Todo> {
    const timestamp = this.now().toISOString();
    return this.repository.create({
      id: this.createId(),
      title: input.title,
      description: input.description ?? "",
      completed: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  update(id: string, input: UpdateTodoInput): Promise<Todo> {
    return this.repository.update(id, input, this.now().toISOString());
  }

  delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
