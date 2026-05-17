import { useState } from 'react';

export interface ShareData {
  id: string;
  fileId: string;
  shareCode: string;
  expiresAt: string | null;
}

export function useFileShare() {
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createShare = async (fileId: string, expiresInHours?: number) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/backend/share/files/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expiresInHours }),
      });
      if (!res.ok) throw new Error('Failed to create share link');
      const data = await res.json();
      setShareData(data.data);
      return data.data as ShareData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const revokeShare = async (fileId: string) => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/backend/share/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to revoke share link');
      setShareData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return { shareData, loading, error, createShare, revokeShare };
}
