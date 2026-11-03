import type { User, Session, FinancialGroup } from '../db/schema.js';

export type GroupRole = 'GROUP_MANAGER' | 'EDITOR' | 'VIEWER';

export interface AppVariables {
  user: User;
  session: Session;
  group: FinancialGroup;
  groupId: string;
  groupRole: GroupRole;
}

export type AppEnv = {
  Variables: AppVariables;
};
