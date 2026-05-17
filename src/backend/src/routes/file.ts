import { Router } from 'express';
import { fileController } from '../controllers/file';
import { authenticate } from '../middleware/auth';
import { autoSaveRateLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  createFileSchema,
  updateFileSchema,
  getFileSchema,
  listFilesSchema,
  deleteFileSchema,
  updateFileContentSchema,
  autoSaveSchema,
  moveFileSchema,
  copyFileSchema,
  renameFileSchema,
} from '../validators/file';
import { upload } from '../middleware/upload';
import { examFileGuard } from '../middleware/examFile';

const router = Router();

router.use(authenticate);

//POST /api/files
/*
Bearer token {HERE}
Body:
{
  "name": "hello.py",
  "path": "/hello.py",
  "content": "print(\"Hello, World!\")"
}
Response:
{
  "success": true,
  "message": "File created successfully",
  "data": {
    "id": "04620ac4-ea0b-4482-ab32-1623f94a408b",
    "userId": "f4a24605-1cfd-451c-b9cd-951822c06074",
    "name": "hello.py",
    "path": "/hello.py",
    "parentId": null,
    "isDirectory": false,
    "mimeType": "text/plain",
    "size": 22,
    "deletedAt": null,
    "createdAt": "2026-02-05T22:09:47.381Z",
    "updatedAt": "2026-02-05T22:09:47.381Z"
  },
  "timestamp": "2026-02-05T22:09:47.412Z"
}
For Directory
{
  "name": "projects",
  "path": "/projects",
  "isDirectory": true
}
To put file in Directory
{
    "name": "main.py",
    "path": "/projects/main.py",
    "parentId": "9b3b7a87-3e74-4211-a2c0-6b805956e866",
    "content": "def main():\n    print(\"Hello from main!\")"
}
*/
router.post(
  '/',
  validate(createFileSchema),
  examFileGuard,
  fileController.createFile.bind(fileController)
);

//GET /api/files
/**
Bearer token {HERE}
Response:
{
{
  "success": true,
  "data": [
    {
      "id": "def14695-4c46-4e1b-a012-b1de5a218431",
      "userId": "f4a24605-1cfd-451c-b9cd-951822c06074",
      "name": "hello.py",
      "path": "/helllo.py",
      "parentId": null,
      "isDirectory": false,
      "mimeType": "text/plain",
      "size": 22,
      "deletedAt": null,
      "createdAt": "2026-02-05T22:22:59.946Z",
      "updatedAt": "2026-02-05T22:22:59.946Z"
    },
  ],
  "timestamp": "2026-02-05T22:23:18.706Z"
}
}
*/
router.get(
  '/',
  validate(listFilesSchema),
  examFileGuard,
  fileController.listFiles.bind(fileController)
);

//GET /api/files/tree
//Displays all files in order
router.get('/tree', examFileGuard, fileController.getFileTree.bind(fileController));

//GET /api/files/search?q=searchTerm
router.get(
  '/search',
  validate(listFilesSchema),
  examFileGuard,
  fileController.searchFiles.bind(fileController)
);

//GET /api/files/trash only trash deleted
router.get(
  '/trash',
  validate(listFilesSchema),
  examFileGuard,
  fileController.getTrash.bind(fileController)
);

//POST /api/files/upload
/*
body->form-data
key:
file->file from disk
path->/src/hello.py
parentId-><dir-uuid> (optional)
*/
router.post(
  '/upload',
  upload.single('file'),
  examFileGuard,
  fileController.uploadFile.bind(fileController)
);

//GET /api/files/:id
//Gets specific file metadata
//For fileid: http://localhost:3000/api/backend/files/a1bc97bc-9aae-4d1a-99c5-793de75c73c4
//For directory: http://localhost:3000/api/backend/files/?parentId=9b3b7a87-3e74-4211-a2c0-6b805956e866
router.get(
  '/:id',
  validate(getFileSchema),
  examFileGuard,
  fileController.getFile.bind(fileController)
);

//Get file content for Monaco Editor
//GET /api/files/:id/content
router.get(
  '/:id/content',
  validate(getFileSchema),
  examFileGuard,
  fileController.getFileContent.bind(fileController)
);

//POST /api/files/:id/restore
router.post('/:id/restore', examFileGuard, fileController.restoreFile.bind(fileController));

//Update file content
//PUT /api/files/:id/content
router.put(
  '/:id/content',
  validate(updateFileContentSchema),
  examFileGuard,
  fileController.updateFileContent.bind(fileController)
);

//Auto-save endpoint
//PATCH /api/files/:id/auto-save
router.patch(
  '/:id/auto-save',
  autoSaveRateLimiter,
  validate(autoSaveSchema),
  examFileGuard,
  fileController.autoSaveFile.bind(fileController)
);

//GET /api/files/:id/download
//http://localhost:3000/api/backend/files/a1bc97bc-9aae-4d1a-99c5-793de75c73c4/download
//Should return the content
router.get(
  '/:id/download',
  validate(getFileSchema),
  examFileGuard,
  fileController.downloadFile.bind(fileController)
);

//POST /api/files/:id/move
router.post(
  '/:id/move',
  validate(moveFileSchema),
  examFileGuard,
  fileController.moveFile.bind(fileController)
);

//POST /api/files/:id/copy
/*
Body
{
  "newName": "copy.py",
  "newPath": "/copy.py"
}
Response
Pratically same as others
*/
router.post(
  '/:id/copy',
  validate(copyFileSchema),
  examFileGuard,
  fileController.copyFile.bind(fileController)
);

//POST /api/files/:id/rename
/*
Body
{
    "newName": "new-name.py"
}
*/
router.post(
  '/:id/rename',
  validate(renameFileSchema),
  examFileGuard,
  fileController.renameFile.bind(fileController)
);

//PUT /api/files/:id
/*
Body:
{
  "content": "print(\"Hello, Updated World!\")"
}
Can do name and path aswell
*/
router.put(
  '/:id',
  validate(updateFileSchema),
  examFileGuard,
  fileController.updateFile.bind(fileController)
);

//DELETE /api/files/:id
router.delete(
  '/:id',
  validate(deleteFileSchema),
  examFileGuard,
  fileController.deleteFile.bind(fileController)
);

//DELETE /api/files/:id/permanent
router.delete(
  '/:id/permanent',
  validate(deleteFileSchema),
  examFileGuard,
  fileController.permanentlyDeleteFile.bind(fileController)
);

export default router;
