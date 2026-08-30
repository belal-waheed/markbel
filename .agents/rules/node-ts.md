# Node.js & TypeScript Project Rules

- Clean layered architecture: Controller -> Service -> Repository.
- Domain services must return Result<T, E> envelope types.
- Edge request validation using Zod schemas before controller invocation.
- Central error-handling middleware with 4 arguments.
- Unit testing with Vitest or Jest; mock only external database/API boundaries.
