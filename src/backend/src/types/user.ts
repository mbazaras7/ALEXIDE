export interface UserPublic {
  id: string;
  email: string;
  name: string | null;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  createdAt: Date;
}

export interface UserData extends UserPublic {
  password?: string;
  updatedAt?: Date;
}
