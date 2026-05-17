export interface FileShareData {
  id: string;
  fileId: string;
  ownerId: string;
  shareCode: string;
  expiresAt: Date | null;
  createdAt: Date;
}
