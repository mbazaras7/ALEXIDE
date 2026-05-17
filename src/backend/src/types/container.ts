import type { Container } from 'dockerode';

export interface ContainerInfo {
  containerId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface ContainerState {
  container: Container;
  info: ContainerInfo;
  inactivityTimer: ReturnType<typeof setTimeout>;
}
