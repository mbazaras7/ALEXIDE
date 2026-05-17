import { z } from 'zod';

export const createFileSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'File name is required'),
    path: z.string().min(1, 'File path is required').regex(/^\//, 'Path must start with /'),
    parentId: z.string().uuid().optional(),
    isDirectory: z.boolean().optional(),
    content: z.string().optional(),
  }),
});

export const updateFileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    path: z.string().regex(/^\//, 'Path must start with /').optional(),
    parentId: z.string().uuid().optional(),
    content: z.string().optional(),
  }),
});

export const getFileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
});

export const listFilesSchema = z.object({
  query: z.object({
    parentId: z.string().uuid().optional(),
    includeDeleted: z.enum(['true', 'false']).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
    search: z.string().optional(),
  }),
});

export const deleteFileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
});

export const fileContentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    content: z.string().min(1, 'Content is required'),
    lastUpdatedAt: z.string().datetime().optional(), // ISO timestamp for conflict detection
  }),
});

export const updateFileContentSchema = fileContentSchema;
export const autoSaveSchema = fileContentSchema;

export const moveFileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    newParentId: z.string().uuid().optional().nullable(),
    newPath: z.string().min(1, 'New path is required').regex(/^\//, 'Path must start with /'),
  }),
});

export const copyFileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    newName: z.string().min(1, 'Name is required').max(255, 'Name too long'),
    newPath: z.string().min(1, 'New path is required').regex(/^\//, 'Path must start with /'),
    newParentId: z.string().uuid('Invalid parent ID').optional().nullable(),
  }),
});

export const renameFileSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid file ID'),
  }),
  body: z.object({
    newName: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  }),
});
