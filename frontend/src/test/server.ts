import { setupServer } from 'msw/node';
import { createHandlers, createMockDb, type MockDb } from '@/mocks/handlers';

/** Shared MSW server. Each test calls `installMockApi()` to install a fresh in-memory backend. */
export const server = setupServer();

export function installMockApi(db: MockDb = createMockDb()): MockDb {
  server.use(...createHandlers(db));
  return db;
}

export const TEST_USER = {
  email: 'abhi@example.com',
  password: 'correct-horse-battery',
  displayName: 'Abhi Chendika',
};
