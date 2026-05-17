import { describe, it, expect, afterEach, beforeEach } from '@jest/globals';
import { db, client } from '../index';
import {
  users,
  files,
  classes,
  classMembers,
  grades,
  assignments,
  testCases,
  submissions,
  collaborationStates,
  fileShares,
  exams,
  examQuestions,
  examTestCases,
  examSessions,
  examQuestionSubmissions,
} from '../schema';
import { sql, eq, and, isNull } from 'drizzle-orm';

describe('Database Migration Tests', () => {
  describe('Database Connection', () => {
    it('should connect to the database successfully', async () => {
      const result = await client`SELECT 1 as result`;
      expect(result[0].result).toBe(1);
    });

    it('should have the correct database name', async () => {
      const result = await client`SELECT current_database()`;
      expect(result[0].current_database).toBeDefined();
    });
  });
  describe('Users Table', () => {
    describe('Schema Tables', () => {
      it('should have users table', async () => {
        const result = await client`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        )
      `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in users table', async () => {
        const result = await client`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `;

        const columns = result.map((row) => ({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
        }));

        const columnNames = columns.map((c) => c.name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('email');
        expect(columnNames).toContain('password');
        expect(columnNames).toContain('role');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have user_role enum type', async () => {
        const result = await client`
        SELECT EXISTS (
          SELECT FROM pg_type 
          WHERE typname = 'user_role'
        )
      `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct enum values for user_role', async () => {
        const result = await client`
        SELECT e.enumlabel as value
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'user_role'
        ORDER BY e.enumsortorder
      `;

        const enumValues = result.map((row) => row.value);
        expect(enumValues).toContain('STUDENT');
        expect(enumValues).toContain('TEACHER');
        expect(enumValues).toContain('ADMIN');
        expect(enumValues.length).toBe(3);
      });
    });

    describe('Table Constraints', () => {
      it('should have primary key on users.id', async () => {
        const result = await client`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'users' 
        AND constraint_type = 'PRIMARY KEY'
      `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have unique constraint on users.email', async () => {
        const result = await client`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'users' 
        AND constraint_type = 'UNIQUE'
      `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' 
        AND is_nullable = 'NO'
      `;

        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('email');
        expect(notNullColumns).toContain('password');
        expect(notNullColumns).toContain('role');
      });
    });

    describe('Default Values', () => {
      it('should have default value for role column', async () => {
        const result = await client`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'users' 
        AND column_name = 'role'
      `;
        expect(result[0].column_default).toContain('STUDENT');
      });

      it('should have default timestamp for created_at', async () => {
        const result = await client`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'users' 
        AND column_name = 'created_at'
      `;
        expect(result[0].column_default).toBeDefined();
        expect(result[0].column_default).toContain('now()');
      });

      it('should have default timestamp for updated_at', async () => {
        const result = await client`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'users' 
        AND column_name = 'updated_at'
      `;
        expect(result[0].column_default).toBeDefined();
        expect(result[0].column_default).toContain('now()');
      });
    });

    describe('Data Operations', () => {
      let testUserId: string;

      afterEach(async () => {
        if (testUserId) {
          await client`DELETE FROM users WHERE id = ${testUserId}`;
          testUserId = '';
        }
      });

      it('should insert a user with default role', async () => {
        const result = await client`
        INSERT INTO users (id, email, password, name)
        VALUES (gen_random_uuid()::text, 'test-migration@example.com', 'hashed_password', 'Test User')
        RETURNING id, role
      `;

        testUserId = result[0].id;
        expect(result[0].role).toBe('STUDENT');
      });

      it('should enforce unique email constraint', async () => {
        const result1 = await client`
        INSERT INTO users (id, email, password, name)
        VALUES (gen_random_uuid()::text, 'duplicate@example.com', 'password1', 'User 1')
        RETURNING id
      `;
        testUserId = result1[0].id;

        await expect(
          client`
          INSERT INTO users (id, email, password, name)
          VALUES (gen_random_uuid()::text, 'duplicate@example.com', 'password2', 'User 2')
        `
        ).rejects.toThrow();
      });
    });

    describe('Drizzle ORM Integration', () => {
      let testUserId: string;

      afterEach(async () => {
        if (testUserId) {
          await db.delete(users).where(sql`id = ${testUserId}`);
          testUserId = '';
        }
      });

      it('should query users table using Drizzle', async () => {
        const allUsers = await db.select().from(users);
        expect(Array.isArray(allUsers)).toBe(true);
      });

      it('should insert user using Drizzle', async () => {
        const [newUser] = await db
          .insert(users)
          .values({
            email: 'drizzle-test@example.com',
            password: 'hashed_password',
            name: 'Drizzle Test',
            role: 'STUDENT',
          })
          .returning();

        testUserId = newUser.id;

        expect(newUser.id).toBeDefined();
        expect(newUser.email).toBe('drizzle-test@example.com');
        expect(newUser.role).toBe('STUDENT');
      });

      it('should select user by email using Drizzle', async () => {
        const [newUser] = await db
          .insert(users)
          .values({
            email: 'select-test@example.com',
            password: 'password',
            name: 'Select Test',
          })
          .returning();

        testUserId = newUser.id;

        const [foundUser] = await db
          .select()
          .from(users)
          .where(sql`email = 'select-test@example.com'`);

        expect(foundUser).toBeDefined();
        expect(foundUser.id).toBe(newUser.id);
      });
    });
  });
  describe('Files Table', () => {
    let testUserId: string;
    let testFileId: string;
    let testFile2Id: string;

    beforeEach(async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: `test-files-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Test User',
        })
        .returning();
      testUserId = user.id;
    });

    afterEach(async () => {
      if (testFile2Id) {
        await db.delete(files).where(eq(files.id, testFile2Id));
      }
      if (testFileId) {
        await db.delete(files).where(eq(files.id, testFileId));
      }
      if (testUserId) {
        await db.delete(users).where(eq(users.id, testUserId));
      }
    });

    describe('Table Structure', () => {
      it('should have files table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'files'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in files table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'files'
          ORDER BY ordinal_position
        `;

        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('user_id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('path');
        expect(columnNames).toContain('parent_id');
        expect(columnNames).toContain('is_directory');
        expect(columnNames).toContain('mime_type');
        expect(columnNames).toContain('size');
        expect(columnNames).toContain('storage_key');
        expect(columnNames).toContain('deleted_at');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });
    });

    describe('Indexes', () => {
      it('should have index on user_id', async () => {
        const result = await client`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'files' 
          AND indexname = 'files_user_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on parent_id', async () => {
        const result = await client`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'files' 
          AND indexname = 'files_parent_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on path', async () => {
        const result = await client`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'files' 
          AND indexname = 'files_path_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on deleted_at', async () => {
        const result = await client`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'files' 
          AND indexname = 'files_deleted_at_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have unique index on user_id + path', async () => {
        const result = await client`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = 'files' 
          AND indexname = 'files_user_id_path_idx'
        `;
        expect(result.length).toBe(1);
      });
    });

    describe('Constraints', () => {
      it('should have primary key on files.id', async () => {
        const result = await client`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'files'
          AND constraint_type = 'PRIMARY KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have foreign key from files.user_id to users.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'files'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'files'
          AND is_nullable = 'NO'
        `;

        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('user_id');
        expect(notNullColumns).toContain('name');
        expect(notNullColumns).toContain('path');
        expect(notNullColumns).toContain('is_directory');
        expect(notNullColumns).toContain('created_at');
        expect(notNullColumns).toContain('updated_at');
      });

      it('should delete files when user is deleted', async () => {
        const [file] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'cascade-test.py',
            path: '/cascade-test.py',
            isDirectory: false,
          })
          .returning();

        const fileId = file.id;
        await db.delete(users).where(eq(users.id, testUserId));
        const foundFile = await db.select().from(files).where(eq(files.id, fileId));
        expect(foundFile.length).toBe(0);
        testUserId = '';
      });
    });

    describe('Data Operations with Drizzle', () => {
      it('should insert a file', async () => {
        const [file] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'main.py',
            path: '/projects/main.py',
            mimeType: 'text/plain',
            size: 1024,
            storageKey: 'users/test-user/projects/main.py',
          })
          .returning();

        testFileId = file.id;
        expect(file.id).toBeDefined();
        expect(file.name).toBe('main.py');
        expect(file.userId).toBe(testUserId);
        expect(file.size).toBe(1024);
      });

      it('should insert a directory', async () => {
        const [dir] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'projects',
            path: '/projects',
            isDirectory: true,
          })
          .returning();

        testFileId = dir.id;
        expect(dir.isDirectory).toBe(true);
        expect(dir.storageKey).toBeNull();
      });

      it('should create parent-child relationship', async () => {
        const [parent] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'projects',
            path: '/projects',
            isDirectory: true,
          })
          .returning();

        testFileId = parent.id;

        const [child] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'main.py',
            path: '/projects/main.py',
            parentId: parent.id,
          })
          .returning();

        testFile2Id = child.id;
        expect(child.parentId).toBe(parent.id);
      });

      it('should enforce unique path per user', async () => {
        const [file] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'unique-test.py',
            path: '/unique-test.py',
          })
          .returning();

        testFileId = file.id;

        await expect(
          db.insert(files).values({
            userId: testUserId,
            name: 'unique-test.py',
            path: '/unique-test.py',
          })
        ).rejects.toThrow();
      });

      it('should allow same path for different users', async () => {
        const [user2] = await db
          .insert(users)
          .values({
            email: `test-unique-${Date.now()}@example.com`,
            password: 'password',
            name: 'User 2',
          })
          .returning();

        const [file1] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'shared.py',
            path: '/shared.py',
          })
          .returning();

        testFileId = file1.id;

        const [file2] = await db
          .insert(files)
          .values({
            userId: user2.id,
            name: 'shared.py',
            path: '/shared.py',
          })
          .returning();

        testFile2Id = file2.id;

        expect(file1.path).toBe(file2.path);
        expect(file1.userId).not.toBe(file2.userId);

        await db.delete(users).where(eq(users.id, user2.id));
      });

      it('should query files by user', async () => {
        await db.insert(files).values({
          userId: testUserId,
          name: 'file1.py',
          path: '/file1.py',
        });

        await db.insert(files).values({
          userId: testUserId,
          name: 'file2.py',
          path: '/file2.py',
        });

        const userFiles = await db.select().from(files).where(eq(files.userId, testUserId));

        expect(userFiles.length).toBeGreaterThanOrEqual(2);

        await client`DELETE FROM files WHERE user_id = ${testUserId}`;
      });
    });

    describe('Soft Delete', () => {
      it('should soft delete a file', async () => {
        const [file] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'delete-me.txt',
            path: '/delete-me.txt',
          })
          .returning();

        testFileId = file.id;

        await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, file.id));

        const [deletedFile] = await db.select().from(files).where(eq(files.id, file.id));

        expect(deletedFile.deletedAt).not.toBeNull();
        expect(deletedFile.deletedAt instanceof Date).toBe(true);
      });

      it('should filter out deleted files', async () => {
        const [activeFile] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'active.txt',
            path: '/active.txt',
          })
          .returning();

        testFileId = activeFile.id;

        const [deletedFile] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'deleted.txt',
            path: '/deleted.txt',
            deletedAt: new Date(),
          })
          .returning();

        testFile2Id = deletedFile.id;

        const activeFiles = await db
          .select()
          .from(files)
          .where(and(eq(files.userId, testUserId), isNull(files.deletedAt)));

        expect(activeFiles.length).toBe(1);
        expect(activeFiles[0].name).toBe('active.txt');
      });

      it('should allow same path after soft delete', async () => {
        const [file1] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'reuse-path.py',
            path: '/reuse-path.py',
          })
          .returning();

        await db.update(files).set({ deletedAt: new Date() }).where(eq(files.id, file1.id));

        const [file2] = await db
          .insert(files)
          .values({
            userId: testUserId,
            name: 'reuse-path.py',
            path: '/reuse-path.py',
          })
          .returning();

        testFileId = file2.id;
        expect(file2.path).toBe(file1.path);
        expect(file2.id).not.toBe(file1.id);

        await client`DELETE FROM files WHERE user_id = ${testUserId}`;
      });
    });
  });
  describe('Classes Table', () => {
    let testTeacherId: string;
    let testClassId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-classes-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Test Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;
    });

    afterEach(async () => {
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have classes table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'classes'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in classes table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'classes'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('description');
        expect(columnNames).toContain('teacher_id');
        expect(columnNames).toContain('join_code');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'classes'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('name');
        expect(notNullColumns).toContain('teacher_id');
        expect(notNullColumns).toContain('join_code');
        expect(notNullColumns).toContain('created_at');
        expect(notNullColumns).toContain('updated_at');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have primary key on classes.id', async () => {
        const result = await client`
          SELECT constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'classes'
          AND constraint_type = 'PRIMARY KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have index on teacher_id', async () => {
        const result = await client`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'classes'
          AND indexname = 'classes_teacher_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have unique index on join_code', async () => {
        const result = await client`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'classes'
          AND indexname = 'classes_join_code_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key from classes.teacher_id to users.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'classes'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Data Operations', () => {
      it('should insert a class', async () => {
        const [newClass] = await db
          .insert(classes)
          .values({
            name: 'Python',
            description: 'Python',
            teacherId: testTeacherId,
            joinCode: `TEST-${Date.now()}`,
          })
          .returning();

        testClassId = newClass.id;
        expect(newClass.id).toBeDefined();
        expect(newClass.name).toBe('Python');
        expect(newClass.teacherId).toBe(testTeacherId);
        expect(newClass.description).toBe('Python');
      });

      it('should enforce unique join_code constraint', async () => {
        const sharedCode = `DUPE-${Date.now()}`;

        const [first] = await db
          .insert(classes)
          .values({
            name: 'First Class',
            teacherId: testTeacherId,
            joinCode: sharedCode,
          })
          .returning();

        testClassId = first.id;

        await expect(
          db.insert(classes).values({
            name: 'Second Class',
            teacherId: testTeacherId,
            joinCode: sharedCode,
          })
        ).rejects.toThrow();
      });

      it('should cascade delete classes when teacher is deleted', async () => {
        const [tempTeacher] = await db
          .insert(users)
          .values({
            email: `cascade-teacher-${Date.now()}@example.com`,
            password: 'password',
            name: 'Cascade Teacher',
            role: 'TEACHER',
          })
          .returning();

        const [orphanClass] = await db
          .insert(classes)
          .values({
            name: 'Orphan Class',
            teacherId: tempTeacher.id,
            joinCode: `CASCADE-${Date.now()}`,
          })
          .returning();

        await db.delete(users).where(eq(users.id, tempTeacher.id));

        const found = await db.select().from(classes).where(eq(classes.id, orphanClass.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('ClassMembers Table', () => {
    let testTeacherId: string;
    let testStudentId: string;
    let testClassId: string;
    let testMemberId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-members-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Test Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [student] = await db
        .insert(users)
        .values({
          email: `student-members-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Test Student',
          role: 'STUDENT',
        })
        .returning();
      testStudentId = student.id;

      const [newClass] = await db
        .insert(classes)
        .values({
          name: 'Test Class',
          teacherId: testTeacherId,
          joinCode: `MEMBER-${Date.now()}`,
        })
        .returning();
      testClassId = newClass.id;
    });

    afterEach(async () => {
      if (testMemberId) {
        await db.delete(classMembers).where(eq(classMembers.id, testMemberId));
        testMemberId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testStudentId) {
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have class_members table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'class_members'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in class_members table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'class_members'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('class_id');
        expect(columnNames).toContain('student_id');
        expect(columnNames).toContain('joined_at');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on class_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'class_members'
          AND indexname = 'class_members_class_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on student_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'class_members'
          AND indexname = 'class_members_student_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have unique index on class_id + student_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'class_members'
          AND indexname = 'class_members_class_student_idx'
        `;
        expect(result.length).toBe(1);
      });
    });

    describe('Data Operations', () => {
      it('should enrol a student into a class', async () => {
        const [member] = await db
          .insert(classMembers)
          .values({
            classId: testClassId,
            studentId: testStudentId,
          })
          .returning();

        testMemberId = member.id;
        expect(member.id).toBeDefined();
        expect(member.classId).toBe(testClassId);
        expect(member.studentId).toBe(testStudentId);
        expect(member.joinedAt).toBeDefined();
      });

      it('should prevent a student from joining the same class twice', async () => {
        const [member] = await db
          .insert(classMembers)
          .values({
            classId: testClassId,
            studentId: testStudentId,
          })
          .returning();

        testMemberId = member.id;

        await expect(
          db.insert(classMembers).values({
            classId: testClassId,
            studentId: testStudentId,
          })
        ).rejects.toThrow();
      });

      it('should cascade delete memberships when class is deleted', async () => {
        const [member] = await db
          .insert(classMembers)
          .values({
            classId: testClassId,
            studentId: testStudentId,
          })
          .returning();

        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';

        const found = await db.select().from(classMembers).where(eq(classMembers.id, member.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('Grades Table', () => {
    let testTeacherId: string;
    let testStudentId: string;
    let testClassId: string;
    let testGradeId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-grades-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Grade Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [student] = await db
        .insert(users)
        .values({
          email: `student-grades-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Grade Student',
          role: 'STUDENT',
        })
        .returning();
      testStudentId = student.id;

      const [newClass] = await db
        .insert(classes)
        .values({
          name: 'Grades Test Class',
          teacherId: testTeacherId,
          joinCode: `GRADE-${Date.now()}`,
        })
        .returning();
      testClassId = newClass.id;
    });

    afterEach(async () => {
      if (testGradeId) {
        await db.delete(grades).where(eq(grades.id, testGradeId));
        testGradeId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testStudentId) {
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have grades table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'grades'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in grades table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'grades'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('student_id');
        expect(columnNames).toContain('class_id');
        expect(columnNames).toContain('source_type');
        expect(columnNames).toContain('source_id');
        expect(columnNames).toContain('score');
        expect(columnNames).toContain('max_score');
        expect(columnNames).toContain('released_at');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have source_type enum with correct values', async () => {
        const result = await client`
          SELECT e.enumlabel as value
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'source_type'
          ORDER BY e.enumsortorder
        `;
        const enumValues = result.map((row) => row.value);
        expect(enumValues).toContain('ASSIGNMENT');
        expect(enumValues).toContain('EXAM');
        expect(enumValues.length).toBe(2);
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on student_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'grades'
          AND indexname = 'grades_student_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on class_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'grades'
          AND indexname = 'grades_class_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on source_type and source_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'grades'
          AND indexname = 'grades_source_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have unique index on student_id + source_id + source_type', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'grades'
          AND indexname = 'grades_student_source_idx'
        `;
        expect(result.length).toBe(1);
      });
    });

    describe('Data Operations', () => {
      it('should insert a grade for an assignment', async () => {
        const [grade] = await db
          .insert(grades)
          .values({
            studentId: testStudentId,
            classId: testClassId,
            sourceType: 'ASSIGNMENT',
            sourceId: 'mock-assignment-id-1',
            score: 85,
            maxScore: 100,
          })
          .returning();

        testGradeId = grade.id;
        expect(grade.id).toBeDefined();
        expect(grade.score).toBe(85);
        expect(grade.maxScore).toBe(100);
        expect(grade.sourceType).toBe('ASSIGNMENT');
        expect(grade.releasedAt).toBeNull();
      });

      it('should insert a grade for an exam', async () => {
        const [grade] = await db
          .insert(grades)
          .values({
            studentId: testStudentId,
            classId: testClassId,
            sourceType: 'EXAM',
            sourceId: 'mock-exam-id-1',
            score: 70,
            maxScore: 100,
          })
          .returning();

        testGradeId = grade.id;
        expect(grade.sourceType).toBe('EXAM');
      });

      it('should release a grade by setting releasedAt', async () => {
        const [grade] = await db
          .insert(grades)
          .values({
            studentId: testStudentId,
            classId: testClassId,
            sourceType: 'ASSIGNMENT',
            sourceId: 'mock-assignment-id-2',
            score: 90,
            maxScore: 100,
          })
          .returning();

        testGradeId = grade.id;

        const releaseTime = new Date();
        const [released] = await db
          .update(grades)
          .set({ releasedAt: releaseTime })
          .where(eq(grades.id, grade.id))
          .returning();

        expect(released.releasedAt).not.toBeNull();
        expect(released.releasedAt instanceof Date).toBe(true);
      });

      it('should prevent duplicate grades for the same student and source', async () => {
        const [grade] = await db
          .insert(grades)
          .values({
            studentId: testStudentId,
            classId: testClassId,
            sourceType: 'ASSIGNMENT',
            sourceId: 'mock-assignment-id-3',
            score: 80,
            maxScore: 100,
          })
          .returning();

        testGradeId = grade.id;

        await expect(
          db.insert(grades).values({
            studentId: testStudentId,
            classId: testClassId,
            sourceType: 'ASSIGNMENT',
            sourceId: 'mock-assignment-id-3',
            score: 95,
            maxScore: 100,
          })
        ).rejects.toThrow();
      });

      it('should only return released grades for a student', async () => {
        const fakeSourceId = `filter-test-${Date.now()}`;

        const [unreleased] = await db
          .insert(grades)
          .values({
            studentId: testStudentId,
            classId: testClassId,
            sourceType: 'ASSIGNMENT',
            sourceId: fakeSourceId,
            score: 60,
            maxScore: 100,
          })
          .returning();

        testGradeId = unreleased.id;

        const releasedGrades = await db
          .select()
          .from(grades)
          .where(and(eq(grades.studentId, testStudentId), sql`${grades.releasedAt} IS NOT NULL`));

        const ids = releasedGrades.map((g) => g.id);
        expect(ids).not.toContain(unreleased.id);
      });
    });
  });
  describe('Assignments Table', () => {
    let testTeacherId: string;
    let testClassId: string;
    let testAssignmentId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [cls] = await db
        .insert(classes)
        .values({
          name: 'Assignment Test Class',
          teacherId: testTeacherId,
          joinCode: `ASGN-${Date.now()}`,
        })
        .returning();
      testClassId = cls.id;
    });

    afterEach(async () => {
      if (testAssignmentId) {
        await db.delete(assignments).where(eq(assignments.id, testAssignmentId));
        testAssignmentId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have assignments table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'assignments'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in assignments table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'assignments'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('class_id');
        expect(columnNames).toContain('teacher_id');
        expect(columnNames).toContain('title');
        expect(columnNames).toContain('description');
        expect(columnNames).toContain('due_date');
        expect(columnNames).toContain('max_score');
        expect(columnNames).toContain('language');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have assignment_status enum with correct values', async () => {
        const result = await client`
          SELECT e.enumlabel as value
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'assignment_status'
          ORDER BY e.enumsortorder
        `;
        const enumValues = result.map((row) => row.value);
        expect(enumValues).toContain('DRAFT');
        expect(enumValues).toContain('PUBLISHED');
        expect(enumValues).toContain('CLOSED');
        expect(enumValues.length).toBe(3);
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'assignments'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('class_id');
        expect(notNullColumns).toContain('teacher_id');
        expect(notNullColumns).toContain('title');
        expect(notNullColumns).toContain('max_score');
        expect(notNullColumns).toContain('language');
        expect(notNullColumns).toContain('status');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on class_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'assignments'
          AND indexname = 'assignments_class_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on teacher_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'assignments'
          AND indexname = 'assignments_teacher_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on status', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'assignments'
          AND indexname = 'assignments_status_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on due_date', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'assignments'
          AND indexname = 'assignments_due_date_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key from assignments.class_id to classes.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'assignments'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default status to DRAFT', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'assignments'
          AND column_name = 'status'
        `;
        expect(result[0].column_default).toContain('DRAFT');
      });

      it('should default max_score to 100', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'assignments'
          AND column_name = 'max_score'
        `;
        expect(result[0].column_default).toBe('100');
      });

      it('should default language to python', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'assignments'
          AND column_name = 'language'
        `;
        expect(result[0].column_default).toContain('python');
      });
    });

    describe('Data Operations', () => {
      it('should insert an assignment with defaults', async () => {
        const [asgn] = await db
          .insert(assignments)
          .values({
            classId: testClassId,
            teacherId: testTeacherId,
            title: 'Python',
          })
          .returning();

        testAssignmentId = asgn.id;
        expect(asgn.id).toBeDefined();
        expect(asgn.title).toBe('Python');
        expect(asgn.status).toBe('DRAFT');
        expect(asgn.maxScore).toBe(100);
        expect(asgn.language).toBe('python');
        expect(asgn.dueDate).toBeNull();
      });

      it('should insert a PUBLISHED assignment with due date', async () => {
        const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const [asgn] = await db
          .insert(assignments)
          .values({
            classId: testClassId,
            teacherId: testTeacherId,
            title: 'Published Assignment',
            status: 'PUBLISHED',
            dueDate,
            maxScore: 50,
          })
          .returning();

        testAssignmentId = asgn.id;
        expect(asgn.status).toBe('PUBLISHED');
        expect(asgn.dueDate).toBeInstanceOf(Date);
        expect(asgn.maxScore).toBe(50);
      });

      it('should cascade delete assignments when class is deleted', async () => {
        const [asgn] = await db
          .insert(assignments)
          .values({
            classId: testClassId,
            teacherId: testTeacherId,
            title: 'Cascade Test',
          })
          .returning();

        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';

        const found = await db.select().from(assignments).where(eq(assignments.id, asgn.id));

        expect(found.length).toBe(0);
      });

      it('should update assignment status', async () => {
        const [asgn] = await db
          .insert(assignments)
          .values({
            classId: testClassId,
            teacherId: testTeacherId,
            title: 'Status Update Test',
          })
          .returning();

        testAssignmentId = asgn.id;

        const [updated] = await db
          .update(assignments)
          .set({ status: 'PUBLISHED', updatedAt: new Date() })
          .where(eq(assignments.id, asgn.id))
          .returning();

        expect(updated.status).toBe('PUBLISHED');
      });
    });
  });

  describe('Test Cases Table', () => {
    let testTeacherId: string;
    let testClassId: string;
    let testAssignmentId: string;
    let testCaseId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher${Date.now()}@example.com`,
          password: 'Password123',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [cls] = await db
        .insert(classes)
        .values({
          name: 'TC Test Class',
          teacherId: testTeacherId,
          joinCode: `TC-${Date.now()}`,
        })
        .returning();
      testClassId = cls.id;

      const [asgn] = await db
        .insert(assignments)
        .values({
          classId: testClassId,
          teacherId: testTeacherId,
          title: 'TC Assignment',
        })
        .returning();
      testAssignmentId = asgn.id;
    });

    afterEach(async () => {
      if (testCaseId) {
        await db.delete(testCases).where(eq(testCases.id, testCaseId));
        testCaseId = '';
      }
      if (testAssignmentId) {
        await db.delete(assignments).where(eq(assignments.id, testAssignmentId));
        testAssignmentId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have test_cases table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'test_cases'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in test_cases table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'test_cases'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('assignment_id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('input_data');
        expect(columnNames).toContain('expected_output');
        expect(columnNames).toContain('weight');
        expect(columnNames).toContain('order_index');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'test_cases'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('assignment_id');
        expect(notNullColumns).toContain('name');
        expect(notNullColumns).toContain('expected_output');
        expect(notNullColumns).toContain('weight');
        expect(notNullColumns).toContain('order_index');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on assignment_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'test_cases'
          AND indexname = 'test_cases_assignment_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key from test_cases.assignment_id to assignments.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'test_cases'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default weight to 1', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'test_cases'
          AND column_name = 'weight'
        `;
        expect(result[0].column_default).toBe('1');
      });

      it('should default order_index to 0', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'test_cases'
          AND column_name = 'order_index'
        `;
        expect(result[0].column_default).toBe('0');
      });
    });

    describe('Data Operations', () => {
      it('should insert a test case with defaults', async () => {
        const [tc] = await db
          .insert(testCases)
          .values({
            assignmentId: testAssignmentId,
            name: 'Test addition',
            expectedOutput: '5',
          })
          .returning();

        testCaseId = tc.id;
        expect(tc.id).toBeDefined();
        expect(tc.name).toBe('Test addition');
        expect(tc.expectedOutput).toBe('5');
        expect(tc.weight).toBe(1);
        expect(tc.orderIndex).toBe(0);
        expect(tc.inputData).toBeNull();
      });

      it('should insert a test case with input data', async () => {
        const [tc] = await db
          .insert(testCases)
          .values({
            assignmentId: testAssignmentId,
            name: 'Test with input',
            inputData: '2 3',
            expectedOutput: '5',
            weight: 2,
            orderIndex: 1,
          })
          .returning();

        testCaseId = tc.id;
        expect(tc.inputData).toBe('2 3');
        expect(tc.weight).toBe(2);
        expect(tc.orderIndex).toBe(1);
      });

      it('should cascade delete test cases when assignment is deleted', async () => {
        const [tc] = await db
          .insert(testCases)
          .values({
            assignmentId: testAssignmentId,
            name: 'Cascade TC',
            expectedOutput: 'hello',
          })
          .returning();

        await db.delete(assignments).where(eq(assignments.id, testAssignmentId));
        testAssignmentId = '';

        const found = await db.select().from(testCases).where(eq(testCases.id, tc.id));

        expect(found.length).toBe(0);
      });

      it('should allow multiple test cases per assignment', async () => {
        const [tc1] = await db
          .insert(testCases)
          .values({
            assignmentId: testAssignmentId,
            name: 'TC 1',
            expectedOutput: 'output1',
            orderIndex: 0,
          })
          .returning();

        const [tc2] = await db
          .insert(testCases)
          .values({
            assignmentId: testAssignmentId,
            name: 'TC 2',
            expectedOutput: 'output2',
            orderIndex: 1,
          })
          .returning();

        testCaseId = tc1.id;

        const allCases = await db
          .select()
          .from(testCases)
          .where(eq(testCases.assignmentId, testAssignmentId));

        expect(allCases.length).toBe(2);

        await db.delete(testCases).where(eq(testCases.id, tc2.id));
      });
    });
  });
  describe('Submissions Table', () => {
    let testTeacherId: string;
    let testStudentId: string;
    let testClassId: string;
    let testAssignmentId: string;
    let testSubmissionId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-sub-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;
      const [student] = await db
        .insert(users)
        .values({
          email: `student-sub-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Student',
          role: 'STUDENT',
        })
        .returning();
      testStudentId = student.id;
      const [cls] = await db
        .insert(classes)
        .values({ name: 'Sub Test Class', teacherId: testTeacherId, joinCode: `SUB-${Date.now()}` })
        .returning();
      testClassId = cls.id;
      const [asgn] = await db
        .insert(assignments)
        .values({
          classId: testClassId,
          teacherId: testTeacherId,
          title: 'Sub Assignment',
          status: 'PUBLISHED',
        })
        .returning();
      testAssignmentId = asgn.id;
    });

    afterEach(async () => {
      if (testSubmissionId) {
        await db.delete(submissions).where(eq(submissions.id, testSubmissionId));
        testSubmissionId = '';
      }
      if (testAssignmentId) {
        await db.delete(assignments).where(eq(assignments.id, testAssignmentId));
        testAssignmentId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testStudentId) {
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have submissions table', async () => {
        const result =
          await client`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submissions')`;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in submissions table', async () => {
        const result =
          await client`SELECT column_name FROM information_schema.columns WHERE table_name = 'submissions' ORDER BY ordinal_position`;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('assignment_id');
        expect(columnNames).toContain('student_id');
        expect(columnNames).toContain('code');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('score');
        expect(columnNames).toContain('max_score');
        expect(columnNames).toContain('test_results');
        expect(columnNames).toContain('submitted_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have submission_status enum with correct values', async () => {
        const result =
          await client`SELECT e.enumlabel as value FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'submission_status' ORDER BY e.enumsortorder`;
        const enumValues = result.map((row) => row.value);
        expect(enumValues).toContain('PENDING');
        expect(enumValues).toContain('RUNNING');
        expect(enumValues).toContain('COMPLETED');
        expect(enumValues).toContain('FAILED');
        expect(enumValues.length).toBe(4);
      });

      it('should have not null constraints on required fields', async () => {
        const result =
          await client`SELECT column_name FROM information_schema.columns WHERE table_name = 'submissions' AND is_nullable = 'NO'`;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('assignment_id');
        expect(notNullColumns).toContain('student_id');
        expect(notNullColumns).toContain('code');
        expect(notNullColumns).toContain('status');
        expect(notNullColumns).toContain('submitted_at');
        expect(notNullColumns).toContain('updated_at');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on assignment_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'submissions' AND indexname = 'submissions_assignment_id_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have index on student_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'submissions' AND indexname = 'submissions_student_id_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have index on status', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'submissions' AND indexname = 'submissions_status_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have unique index on student_id + assignment_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'submissions' AND indexname = 'submissions_student_assignment_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have foreign key from submissions.assignment_id to assignments.id', async () => {
        const result =
          await client`SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'submissions' AND constraint_type = 'FOREIGN KEY'`;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default status to PENDING', async () => {
        const result =
          await client`SELECT column_default FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'status'`;
        expect(result[0].column_default).toContain('PENDING');
      });

      it('should have default timestamp for submitted_at', async () => {
        const result =
          await client`SELECT column_default FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'submitted_at'`;
        expect(result[0].column_default).toBeDefined();
        expect(result[0].column_default).toContain('now()');
      });
    });

    describe('Data Operations', () => {
      it('should insert a submission with defaults', async () => {
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        testSubmissionId = sub.id;
        expect(sub.id).toBeDefined();
        expect(sub.code).toBe('print("hello")');
        expect(sub.status).toBe('PENDING');
        expect(sub.score).toBeNull();
        expect(sub.maxScore).toBeNull();
        expect(sub.testResults).toBeNull();
        expect(sub.submittedAt).toBeDefined();
      });

      it('should insert a completed submission with score and test results', async () => {
        const testResults = JSON.stringify([
          { name: 'Test 1', passed: true, actualOutput: 'hello', expectedOutput: 'hello' },
        ]);
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("hello")',
            status: 'COMPLETED',
            score: 100,
            maxScore: 100,
            testResults,
          })
          .returning();
        testSubmissionId = sub.id;
        expect(sub.status).toBe('COMPLETED');
        expect(sub.score).toBe(100);
        expect(sub.maxScore).toBe(100);
        expect(sub.testResults).toBe(testResults);
      });

      it('should enforce unique submission per student per assignment', async () => {
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        testSubmissionId = sub.id;
        await expect(
          db.insert(submissions).values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("world")',
          })
        ).rejects.toThrow();
      });

      it('should upsert — update existing submission on conflict', async () => {
        const [first] = await db
          .insert(submissions)
          .values({ assignmentId: testAssignmentId, studentId: testStudentId, code: 'print("v1")' })
          .returning();
        testSubmissionId = first.id;

        const [updated] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("v2")',
            status: 'RUNNING',
          })
          .onConflictDoUpdate({
            target: [submissions.studentId, submissions.assignmentId],
            set: { code: 'print("v2")', status: 'RUNNING', updatedAt: new Date() },
          })
          .returning();

        expect(updated.id).toBe(first.id);
        expect(updated.code).toBe('print("v2")');
        expect(updated.status).toBe('RUNNING');
      });

      it('should update status from RUNNING to COMPLETED', async () => {
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("hello")',
            status: 'RUNNING',
          })
          .returning();
        testSubmissionId = sub.id;
        const [updated] = await db
          .update(submissions)
          .set({ status: 'COMPLETED', score: 100, maxScore: 100, updatedAt: new Date() })
          .where(eq(submissions.id, sub.id))
          .returning();
        expect(updated.status).toBe('COMPLETED');
        expect(updated.score).toBe(100);
      });

      it('should update status to FAILED', async () => {
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'invalid code',
            status: 'RUNNING',
          })
          .returning();
        testSubmissionId = sub.id;
        const [updated] = await db
          .update(submissions)
          .set({ status: 'FAILED', updatedAt: new Date() })
          .where(eq(submissions.id, sub.id))
          .returning();
        expect(updated.status).toBe('FAILED');
      });

      it('should cascade delete submissions when assignment is deleted', async () => {
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        await db.delete(assignments).where(eq(assignments.id, testAssignmentId));
        testAssignmentId = '';
        const found = await db.select().from(submissions).where(eq(submissions.id, sub.id));
        expect(found.length).toBe(0);
      });

      it('should cascade delete submissions when student is deleted', async () => {
        const [sub] = await db
          .insert(submissions)
          .values({
            assignmentId: testAssignmentId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
        const found = await db.select().from(submissions).where(eq(submissions.id, sub.id));
        expect(found.length).toBe(0);
      });

      it('should allow different students to submit to the same assignment', async () => {
        const [student2] = await db
          .insert(users)
          .values({
            email: `student2-sub-${Date.now()}@example.com`,
            password: 'Password123',
            name: 'Student 2',
            role: 'STUDENT',
          })
          .returning();
        const [sub1] = await db
          .insert(submissions)
          .values({ assignmentId: testAssignmentId, studentId: testStudentId, code: 'print("s1")' })
          .returning();
        testSubmissionId = sub1.id;
        const [sub2] = await db
          .insert(submissions)
          .values({ assignmentId: testAssignmentId, studentId: student2.id, code: 'print("s2")' })
          .returning();
        expect(sub1.studentId).not.toBe(sub2.studentId);
        expect(sub1.assignmentId).toBe(sub2.assignmentId);
        await db.delete(submissions).where(eq(submissions.id, sub2.id));
        await db.delete(users).where(eq(users.id, student2.id));
      });
    });
  });

  describe('CollaborationStates Table', () => {
    let testUserId: string;
    let testFileId: string;
    let testCollabId: string;

    beforeEach(async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: `collab-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Collab User',
        })
        .returning();
      testUserId = user.id;

      const [file] = await db
        .insert(files)
        .values({
          userId: testUserId,
          name: 'collab.py',
          path: '/collab.py',
        })
        .returning();
      testFileId = file.id;
    });

    afterEach(async () => {
      if (testCollabId) {
        await db.delete(collaborationStates).where(eq(collaborationStates.id, testCollabId));
        testCollabId = '';
      }
      if (testFileId) {
        await db.delete(files).where(eq(files.id, testFileId));
        testFileId = '';
      }
      if (testUserId) {
        await db.delete(users).where(eq(users.id, testUserId));
        testUserId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have collaborationstates table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'collaborationstates'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in collaborationstates table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'collaborationstates'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('fileid');
        expect(columnNames).toContain('statevector');
        expect(columnNames).toContain('updatedat');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'collaborationstates'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('fileid');
        expect(notNullColumns).toContain('statevector');
      });
    });

    describe('Constraints', () => {
      it('should have primary key on collaborationstates.id', async () => {
        const result = await client`
          SELECT constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'collaborationstates'
          AND constraint_type = 'PRIMARY KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have unique constraint on fileid', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'collaborationstates'
          AND constraint_type = 'UNIQUE'
        `;
        expect(result.length).toBeGreaterThan(0);
      });

      it('should have foreign key from collaborationstates.fileid to files.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'collaborationstates'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Data Operations', () => {
      it('should insert a collaboration state', async () => {
        const [collab] = await db
          .insert(collaborationStates)
          .values({
            fileId: testFileId,
            stateVector: 'AQID',
          })
          .returning();

        testCollabId = collab.id;
        expect(collab.id).toBeDefined();
        expect(collab.fileId).toBe(testFileId);
        expect(collab.stateVector).toBe('AQID');
        expect(collab.updatedAt).toBeDefined();
      });

      it('should enforce unique collaboration state per file', async () => {
        const [collab] = await db
          .insert(collaborationStates)
          .values({ fileId: testFileId, stateVector: 'AQID' })
          .returning();

        testCollabId = collab.id;

        await expect(
          db.insert(collaborationStates).values({ fileId: testFileId, stateVector: 'BACD' })
        ).rejects.toThrow();
      });

      it('should update the state vector', async () => {
        const [collab] = await db
          .insert(collaborationStates)
          .values({ fileId: testFileId, stateVector: 'AQID' })
          .returning();

        testCollabId = collab.id;

        const [updated] = await db
          .update(collaborationStates)
          .set({ stateVector: 'NEWVECTOR', updatedAt: new Date() })
          .where(eq(collaborationStates.id, collab.id))
          .returning();

        expect(updated.stateVector).toBe('NEWVECTOR');
      });

      it('should cascade delete when file is deleted', async () => {
        const [collab] = await db
          .insert(collaborationStates)
          .values({ fileId: testFileId, stateVector: 'AQID' })
          .returning();

        await db.delete(files).where(eq(files.id, testFileId));
        testFileId = '';

        const found = await db
          .select()
          .from(collaborationStates)
          .where(eq(collaborationStates.id, collab.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('FileShares Table', () => {
    let testUserId: string;
    let testFileId: string;
    let testShareId: string;

    beforeEach(async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: `shares-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Share Owner',
        })
        .returning();
      testUserId = user.id;

      const [file] = await db
        .insert(files)
        .values({
          userId: testUserId,
          name: 'shared.py',
          path: '/shared.py',
        })
        .returning();
      testFileId = file.id;
    });

    afterEach(async () => {
      if (testShareId) {
        await db.delete(fileShares).where(eq(fileShares.id, testShareId));
        testShareId = '';
      }
      if (testFileId) {
        await db.delete(files).where(eq(files.id, testFileId));
        testFileId = '';
      }
      if (testUserId) {
        await db.delete(users).where(eq(users.id, testUserId));
        testUserId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have fileshares table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'fileshares'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in fileshares table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'fileshares'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('fileid');
        expect(columnNames).toContain('ownerid');
        expect(columnNames).toContain('sharecode');
        expect(columnNames).toContain('expiresat');
        expect(columnNames).toContain('createdat');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'fileshares'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('fileid');
        expect(notNullColumns).toContain('ownerid');
        expect(notNullColumns).toContain('sharecode');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on fileid', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'fileshares'
          AND indexname = 'filesharesfileidx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have unique index on sharecode', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'fileshares'
          AND indexname = 'filesharessharecode'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key constraints', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'fileshares'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Data Operations', () => {
      it('should insert a file share', async () => {
        const shareCode = `SHARE-${Date.now()}`;
        const [share] = await db
          .insert(fileShares)
          .values({
            fileId: testFileId,
            ownerId: testUserId,
            shareCode,
          })
          .returning();

        testShareId = share.id;
        expect(share.id).toBeDefined();
        expect(share.fileId).toBe(testFileId);
        expect(share.ownerId).toBe(testUserId);
        expect(share.shareCode).toBe(shareCode);
        expect(share.expiresAt).toBeNull();
      });

      it('should insert a file share with expiry', async () => {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const [share] = await db
          .insert(fileShares)
          .values({
            fileId: testFileId,
            ownerId: testUserId,
            shareCode: `EXPIRING-${Date.now()}`,
            expiresAt,
          })
          .returning();

        testShareId = share.id;
        expect(share.expiresAt).toBeInstanceOf(Date);
      });

      it('should enforce unique share code', async () => {
        const shareCode = `DUPE-SHARE-${Date.now()}`;
        const [share] = await db
          .insert(fileShares)
          .values({ fileId: testFileId, ownerId: testUserId, shareCode })
          .returning();

        testShareId = share.id;

        await expect(
          db.insert(fileShares).values({ fileId: testFileId, ownerId: testUserId, shareCode })
        ).rejects.toThrow();
      });

      it('should cascade delete shares when file is deleted', async () => {
        const [share] = await db
          .insert(fileShares)
          .values({
            fileId: testFileId,
            ownerId: testUserId,
            shareCode: `CASCADE-SHARE-${Date.now()}`,
          })
          .returning();

        await db.delete(files).where(eq(files.id, testFileId));
        testFileId = '';

        const found = await db.select().from(fileShares).where(eq(fileShares.id, share.id));
        expect(found.length).toBe(0);
      });

      it('should cascade delete shares when owner is deleted', async () => {
        const [share] = await db
          .insert(fileShares)
          .values({
            fileId: testFileId,
            ownerId: testUserId,
            shareCode: `CASCADE-OWNER-${Date.now()}`,
          })
          .returning();

        await db.delete(users).where(eq(users.id, testUserId));
        testUserId = '';
        testFileId = '';

        const found = await db.select().from(fileShares).where(eq(fileShares.id, share.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('Exams Table', () => {
    let testTeacherId: string;
    let testClassId: string;
    let testExamId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-exam-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Exam Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [cls] = await db
        .insert(classes)
        .values({
          name: 'Exam Test Class',
          teacherId: testTeacherId,
          joinCode: `EXAM-${Date.now()}`,
        })
        .returning();
      testClassId = cls.id;
    });

    afterEach(async () => {
      if (testExamId) {
        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have exams table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'exams'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in exams table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exams'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('class_id');
        expect(columnNames).toContain('teacher_id');
        expect(columnNames).toContain('title');
        expect(columnNames).toContain('instructions');
        expect(columnNames).toContain('language');
        expect(columnNames).toContain('duration_minutes');
        expect(columnNames).toContain('scheduled_start');
        expect(columnNames).toContain('scheduled_end');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('max_score');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have exam_status enum with correct values', async () => {
        const result = await client`
          SELECT e.enumlabel as value
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'exam_status'
          ORDER BY e.enumsortorder
        `;
        const enumValues = result.map((row) => row.value);
        expect(enumValues).toContain('DRAFT');
        expect(enumValues).toContain('SCHEDULED');
        expect(enumValues).toContain('ACTIVE');
        expect(enumValues).toContain('COMPLETED');
        expect(enumValues).toContain('CANCELLED');
        expect(enumValues.length).toBe(5);
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exams'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('class_id');
        expect(notNullColumns).toContain('teacher_id');
        expect(notNullColumns).toContain('title');
        expect(notNullColumns).toContain('language');
        expect(notNullColumns).toContain('duration_minutes');
        expect(notNullColumns).toContain('status');
        expect(notNullColumns).toContain('max_score');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on class_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exams'
          AND indexname = 'exams_class_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on teacher_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exams'
          AND indexname = 'exams_teacher_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on status', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exams'
          AND indexname = 'exams_status_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on scheduled_start', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exams'
          AND indexname = 'exams_scheduled_start_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key constraints', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'exams'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default status to DRAFT', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'exams'
          AND column_name = 'status'
        `;
        expect(result[0].column_default).toContain('DRAFT');
      });

      it('should default duration_minutes to 60', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'exams'
          AND column_name = 'duration_minutes'
        `;
        expect(result[0].column_default).toBe('60');
      });

      it('should default max_score to 100', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'exams'
          AND column_name = 'max_score'
        `;
        expect(result[0].column_default).toBe('100');
      });

      it('should default language to python', async () => {
        const result = await client`
          SELECT column_default
          FROM information_schema.columns
          WHERE table_name = 'exams'
          AND column_name = 'language'
        `;
        expect(result[0].column_default).toContain('python');
      });
    });

    describe('Data Operations', () => {
      it('should insert an exam with defaults', async () => {
        const [exam] = await db
          .insert(exams)
          .values({
            classId: testClassId,
            teacherId: testTeacherId,
            title: 'Midterm Exam',
          })
          .returning();

        testExamId = exam.id;
        expect(exam.id).toBeDefined();
        expect(exam.title).toBe('Midterm Exam');
        expect(exam.status).toBe('DRAFT');
        expect(exam.durationMinutes).toBe(60);
        expect(exam.maxScore).toBe(100);
        expect(exam.language).toBe('python');
        expect(exam.scheduledStart).toBeNull();
      });

      it('should insert a scheduled exam', async () => {
        const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

        const [exam] = await db
          .insert(exams)
          .values({
            classId: testClassId,
            teacherId: testTeacherId,
            title: 'Scheduled Exam',
            status: 'SCHEDULED',
            scheduledStart,
            scheduledEnd,
            durationMinutes: 90,
          })
          .returning();

        testExamId = exam.id;
        expect(exam.status).toBe('SCHEDULED');
        expect(exam.scheduledStart).toBeInstanceOf(Date);
        expect(exam.scheduledEnd).toBeInstanceOf(Date);
        expect(exam.durationMinutes).toBe(90);
      });

      it('should update exam status through lifecycle', async () => {
        const [exam] = await db
          .insert(exams)
          .values({ classId: testClassId, teacherId: testTeacherId, title: 'Lifecycle Exam' })
          .returning();

        testExamId = exam.id;

        for (const status of ['SCHEDULED', 'ACTIVE', 'COMPLETED'] as const) {
          const [updated] = await db
            .update(exams)
            .set({ status, updatedAt: new Date() })
            .where(eq(exams.id, exam.id))
            .returning();
          expect(updated.status).toBe(status);
        }
      });

      it('should cascade delete exams when class is deleted', async () => {
        const [exam] = await db
          .insert(exams)
          .values({ classId: testClassId, teacherId: testTeacherId, title: 'Cascade Exam' })
          .returning();

        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';

        const found = await db.select().from(exams).where(eq(exams.id, exam.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('ExamQuestions Table', () => {
    let testTeacherId: string;
    let testClassId: string;
    let testExamId: string;
    let testQuestionId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-eq-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'EQ Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [cls] = await db
        .insert(classes)
        .values({ name: 'EQ Class', teacherId: testTeacherId, joinCode: `EQ-${Date.now()}` })
        .returning();
      testClassId = cls.id;

      const [exam] = await db
        .insert(exams)
        .values({ classId: testClassId, teacherId: testTeacherId, title: 'EQ Exam' })
        .returning();
      testExamId = exam.id;
    });

    afterEach(async () => {
      if (testQuestionId) {
        await db.delete(examQuestions).where(eq(examQuestions.id, testQuestionId));
        testQuestionId = '';
      }
      if (testExamId) {
        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have exam_questions table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'exam_questions'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in exam_questions table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exam_questions'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('exam_id');
        expect(columnNames).toContain('title');
        expect(columnNames).toContain('description');
        expect(columnNames).toContain('max_score');
        expect(columnNames).toContain('language');
        expect(columnNames).toContain('order_index');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exam_questions'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('exam_id');
        expect(notNullColumns).toContain('title');
        expect(notNullColumns).toContain('max_score');
        expect(notNullColumns).toContain('language');
        expect(notNullColumns).toContain('order_index');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on exam_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exam_questions'
          AND indexname = 'exam_questions_exam_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key from exam_questions.exam_id to exams.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'exam_questions'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default max_score to 100', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_questions' AND column_name = 'max_score'
        `;
        expect(result[0].column_default).toBe('100');
      });

      it('should default order_index to 0', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_questions' AND column_name = 'order_index'
        `;
        expect(result[0].column_default).toBe('0');
      });

      it('should default language to python', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_questions' AND column_name = 'language'
        `;
        expect(result[0].column_default).toContain('python');
      });
    });

    describe('Data Operations', () => {
      it('should insert an exam question with defaults', async () => {
        const [question] = await db
          .insert(examQuestions)
          .values({ examId: testExamId, title: 'Q1: FizzBuzz' })
          .returning();

        testQuestionId = question.id;
        expect(question.id).toBeDefined();
        expect(question.title).toBe('Q1: FizzBuzz');
        expect(question.maxScore).toBe(100);
        expect(question.orderIndex).toBe(0);
        expect(question.language).toBe('python');
        expect(question.description).toBeNull();
      });

      it('should insert multiple questions with ordering', async () => {
        const [q1] = await db
          .insert(examQuestions)
          .values({ examId: testExamId, title: 'Q1', orderIndex: 0 })
          .returning();

        testQuestionId = q1.id;

        const [q2] = await db
          .insert(examQuestions)
          .values({ examId: testExamId, title: 'Q2', orderIndex: 1 })
          .returning();

        const questions = await db
          .select()
          .from(examQuestions)
          .where(eq(examQuestions.examId, testExamId));

        expect(questions.length).toBe(2);

        await db.delete(examQuestions).where(eq(examQuestions.id, q2.id));
      });

      it('should cascade delete questions when exam is deleted', async () => {
        const [question] = await db
          .insert(examQuestions)
          .values({ examId: testExamId, title: 'Cascade Q' })
          .returning();

        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';

        const found = await db
          .select()
          .from(examQuestions)
          .where(eq(examQuestions.id, question.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('ExamTestCases Table', () => {
    let testTeacherId: string;
    let testClassId: string;
    let testExamId: string;
    let testQuestionId: string;
    let testExamTCId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-etc-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'ETC Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [cls] = await db
        .insert(classes)
        .values({ name: 'ETC Class', teacherId: testTeacherId, joinCode: `ETC-${Date.now()}` })
        .returning();
      testClassId = cls.id;

      const [exam] = await db
        .insert(exams)
        .values({ classId: testClassId, teacherId: testTeacherId, title: 'ETC Exam' })
        .returning();
      testExamId = exam.id;

      const [question] = await db
        .insert(examQuestions)
        .values({ examId: testExamId, title: 'ETC Question' })
        .returning();
      testQuestionId = question.id;
    });

    afterEach(async () => {
      if (testExamTCId) {
        await db.delete(examTestCases).where(eq(examTestCases.id, testExamTCId));
        testExamTCId = '';
      }
      if (testQuestionId) {
        await db.delete(examQuestions).where(eq(examQuestions.id, testQuestionId));
        testQuestionId = '';
      }
      if (testExamId) {
        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have exam_test_cases table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'exam_test_cases'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in exam_test_cases table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exam_test_cases'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('question_id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('input_data');
        expect(columnNames).toContain('sys_args');
        expect(columnNames).toContain('expected_output');
        expect(columnNames).toContain('weight');
        expect(columnNames).toContain('order_index');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exam_test_cases'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('question_id');
        expect(notNullColumns).toContain('name');
        expect(notNullColumns).toContain('expected_output');
        expect(notNullColumns).toContain('weight');
        expect(notNullColumns).toContain('order_index');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on question_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exam_test_cases'
          AND indexname = 'exam_test_cases_question_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key from exam_test_cases.question_id to exam_questions.id', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'exam_test_cases'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default weight to 1', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_test_cases' AND column_name = 'weight'
        `;
        expect(result[0].column_default).toBe('1');
      });

      it('should default order_index to 0', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_test_cases' AND column_name = 'order_index'
        `;
        expect(result[0].column_default).toBe('0');
      });
    });

    describe('Data Operations', () => {
      it('should insert an exam test case with defaults', async () => {
        const [tc] = await db
          .insert(examTestCases)
          .values({
            questionId: testQuestionId,
            name: 'Basic test',
            expectedOutput: 'hello',
          })
          .returning();

        testExamTCId = tc.id;
        expect(tc.id).toBeDefined();
        expect(tc.name).toBe('Basic test');
        expect(tc.expectedOutput).toBe('hello');
        expect(tc.weight).toBe(1);
        expect(tc.orderIndex).toBe(0);
        expect(tc.inputData).toBeNull();
        expect(tc.sysArgs).toBeNull();
      });

      it('should insert a test case with input data and sys args', async () => {
        const [tc] = await db
          .insert(examTestCases)
          .values({
            questionId: testQuestionId,
            name: 'Input test',
            inputData: '5\n3',
            sysArgs: '--verbose',
            expectedOutput: '8',
            weight: 3,
            orderIndex: 1,
          })
          .returning();

        testExamTCId = tc.id;
        expect(tc.inputData).toBe('5\n3');
        expect(tc.sysArgs).toBe('--verbose');
        expect(tc.weight).toBe(3);
        expect(tc.orderIndex).toBe(1);
      });

      it('should cascade delete test cases when question is deleted', async () => {
        const [tc] = await db
          .insert(examTestCases)
          .values({ questionId: testQuestionId, name: 'Cascade TC', expectedOutput: 'x' })
          .returning();

        await db.delete(examQuestions).where(eq(examQuestions.id, testQuestionId));
        testQuestionId = '';

        const found = await db.select().from(examTestCases).where(eq(examTestCases.id, tc.id));
        expect(found.length).toBe(0);
      });

      it('should allow multiple test cases per question', async () => {
        const [tc1] = await db
          .insert(examTestCases)
          .values({ questionId: testQuestionId, name: 'TC 1', expectedOutput: 'a', orderIndex: 0 })
          .returning();

        testExamTCId = tc1.id;

        const [tc2] = await db
          .insert(examTestCases)
          .values({ questionId: testQuestionId, name: 'TC 2', expectedOutput: 'b', orderIndex: 1 })
          .returning();

        const all = await db
          .select()
          .from(examTestCases)
          .where(eq(examTestCases.questionId, testQuestionId));

        expect(all.length).toBe(2);

        await db.delete(examTestCases).where(eq(examTestCases.id, tc2.id));
      });
    });
  });

  describe('ExamSessions Table', () => {
    let testTeacherId: string;
    let testStudentId: string;
    let testClassId: string;
    let testExamId: string;
    let testSessionId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-es-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'ES Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [student] = await db
        .insert(users)
        .values({
          email: `student-es-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'ES Student',
          role: 'STUDENT',
        })
        .returning();
      testStudentId = student.id;

      const [cls] = await db
        .insert(classes)
        .values({ name: 'ES Class', teacherId: testTeacherId, joinCode: `ES-${Date.now()}` })
        .returning();
      testClassId = cls.id;

      const [exam] = await db
        .insert(exams)
        .values({ classId: testClassId, teacherId: testTeacherId, title: 'ES Exam' })
        .returning();
      testExamId = exam.id;
    });

    afterEach(async () => {
      if (testSessionId) {
        await db.delete(examSessions).where(eq(examSessions.id, testSessionId));
        testSessionId = '';
      }
      if (testExamId) {
        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testStudentId) {
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have exam_sessions table', async () => {
        const result = await client`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'exam_sessions'
          )
        `;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in exam_sessions table', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exam_sessions'
          ORDER BY ordinal_position
        `;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('exam_id');
        expect(columnNames).toContain('student_id');
        expect(columnNames).toContain('started_at');
        expect(columnNames).toContain('submitted_at');
        expect(columnNames).toContain('expires_at');
        expect(columnNames).toContain('tab_switch_count');
        expect(columnNames).toContain('is_submitted');
        expect(columnNames).toContain('created_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have not null constraints on required fields', async () => {
        const result = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'exam_sessions'
          AND is_nullable = 'NO'
        `;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('exam_id');
        expect(notNullColumns).toContain('student_id');
        expect(notNullColumns).toContain('started_at');
        expect(notNullColumns).toContain('expires_at');
        expect(notNullColumns).toContain('tab_switch_count');
        expect(notNullColumns).toContain('is_submitted');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on exam_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exam_sessions'
          AND indexname = 'exam_sessions_exam_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have index on student_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exam_sessions'
          AND indexname = 'exam_sessions_student_id_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have unique index on exam_id + student_id', async () => {
        const result = await client`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'exam_sessions'
          AND indexname = 'exam_sessions_exam_student_idx'
        `;
        expect(result.length).toBe(1);
      });

      it('should have foreign key constraints', async () => {
        const result = await client`
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_name = 'exam_sessions'
          AND constraint_type = 'FOREIGN KEY'
        `;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default tab_switch_count to 0', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_sessions' AND column_name = 'tab_switch_count'
        `;
        expect(result[0].column_default).toBe('0');
      });

      it('should default is_submitted to false', async () => {
        const result = await client`
          SELECT column_default FROM information_schema.columns
          WHERE table_name = 'exam_sessions' AND column_name = 'is_submitted'
        `;
        expect(result[0].column_default).toBe('false');
      });
    });

    describe('Data Operations', () => {
      it('should insert an exam session with defaults', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [session] = await db
          .insert(examSessions)
          .values({
            examId: testExamId,
            studentId: testStudentId,
            expiresAt,
          })
          .returning();

        testSessionId = session.id;
        expect(session.id).toBeDefined();
        expect(session.examId).toBe(testExamId);
        expect(session.studentId).toBe(testStudentId);
        expect(session.isSubmitted).toBe(false);
        expect(session.tabSwitchCount).toBe(0);
        expect(session.submittedAt).toBeNull();
        expect(session.startedAt).toBeDefined();
      });

      it('should enforce one session per student per exam', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [session] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: testStudentId, expiresAt })
          .returning();

        testSessionId = session.id;

        await expect(
          db
            .insert(examSessions)
            .values({ examId: testExamId, studentId: testStudentId, expiresAt })
        ).rejects.toThrow();
      });

      it('should submit an exam session', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [session] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: testStudentId, expiresAt })
          .returning();

        testSessionId = session.id;

        const submittedAt = new Date();
        const [updated] = await db
          .update(examSessions)
          .set({ isSubmitted: true, submittedAt, updatedAt: new Date() })
          .where(eq(examSessions.id, session.id))
          .returning();

        expect(updated.isSubmitted).toBe(true);
        expect(updated.submittedAt).toBeInstanceOf(Date);
      });

      it('should increment tab_switch_count', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [session] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: testStudentId, expiresAt })
          .returning();

        testSessionId = session.id;

        const [updated] = await db
          .update(examSessions)
          .set({ tabSwitchCount: session.tabSwitchCount + 3, updatedAt: new Date() })
          .where(eq(examSessions.id, session.id))
          .returning();

        expect(updated.tabSwitchCount).toBe(3);
      });

      it('should allow different students to have sessions for the same exam', async () => {
        const [student2] = await db
          .insert(users)
          .values({
            email: `student2-es-${Date.now()}@example.com`,
            password: 'Password123',
            name: 'ES Student 2',
            role: 'STUDENT',
          })
          .returning();

        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const [session1] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: testStudentId, expiresAt })
          .returning();
        testSessionId = session1.id;

        const [session2] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: student2.id, expiresAt })
          .returning();

        expect(session1.studentId).not.toBe(session2.studentId);
        expect(session1.examId).toBe(session2.examId);

        await db.delete(examSessions).where(eq(examSessions.id, session2.id));
        await db.delete(users).where(eq(users.id, student2.id));
      });

      it('should cascade delete sessions when exam is deleted', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [session] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: testStudentId, expiresAt })
          .returning();

        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';

        const found = await db.select().from(examSessions).where(eq(examSessions.id, session.id));
        expect(found.length).toBe(0);
      });

      it('should cascade delete sessions when student is deleted', async () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        const [session] = await db
          .insert(examSessions)
          .values({ examId: testExamId, studentId: testStudentId, expiresAt })
          .returning();

        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';

        const found = await db.select().from(examSessions).where(eq(examSessions.id, session.id));
        expect(found.length).toBe(0);
      });
    });
  });

  describe('Exam Question Submissions Table', () => {
    let testTeacherId: string;
    let testStudentId: string;
    let testClassId: string;
    let testExamId: string;
    let testQuestionId: string;
    let testSessionId: string;
    let testExamSubmissionId: string;

    beforeEach(async () => {
      const [teacher] = await db
        .insert(users)
        .values({
          email: `teacher-examsub-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Teacher',
          role: 'TEACHER',
        })
        .returning();
      testTeacherId = teacher.id;

      const [student] = await db
        .insert(users)
        .values({
          email: `student-examsub-${Date.now()}@example.com`,
          password: 'Password123',
          name: 'Student',
          role: 'STUDENT',
        })
        .returning();
      testStudentId = student.id;

      const [cls] = await db
        .insert(classes)
        .values({
          name: 'Exam Sub Test Class',
          teacherId: testTeacherId,
          joinCode: `EXAMSUB-${Date.now()}`,
        })
        .returning();
      testClassId = cls.id;

      const [exam] = await db
        .insert(exams)
        .values({
          classId: testClassId,
          teacherId: testTeacherId,
          title: 'Sub Exam',
          status: 'ACTIVE',
          durationMinutes: 60,
          maxScore: 100,
        })
        .returning();
      testExamId = exam.id;

      const [question] = await db
        .insert(examQuestions)
        .values({
          examId: testExamId,
          title: 'Test Question',
          maxScore: 50,
          orderIndex: 0,
        })
        .returning();
      testQuestionId = question.id;

      const [session] = await db
        .insert(examSessions)
        .values({
          examId: testExamId,
          studentId: testStudentId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })
        .returning();
      testSessionId = session.id;
    });

    afterEach(async () => {
      if (testExamSubmissionId) {
        await db
          .delete(examQuestionSubmissions)
          .where(eq(examQuestionSubmissions.id, testExamSubmissionId));
        testExamSubmissionId = '';
      }
      if (testSessionId) {
        await db.delete(examSessions).where(eq(examSessions.id, testSessionId));
        testSessionId = '';
      }
      if (testQuestionId) {
        await db.delete(examQuestions).where(eq(examQuestions.id, testQuestionId));
        testQuestionId = '';
      }
      if (testExamId) {
        await db.delete(exams).where(eq(exams.id, testExamId));
        testExamId = '';
      }
      if (testClassId) {
        await db.delete(classes).where(eq(classes.id, testClassId));
        testClassId = '';
      }
      if (testStudentId) {
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
      }
      if (testTeacherId) {
        await db.delete(users).where(eq(users.id, testTeacherId));
        testTeacherId = '';
      }
    });

    describe('Table Structure', () => {
      it('should have exam_question_submissions table', async () => {
        const result =
          await client`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exam_question_submissions')`;
        expect(result[0].exists).toBe(true);
      });

      it('should have correct columns in exam_question_submissions table', async () => {
        const result =
          await client`SELECT column_name FROM information_schema.columns WHERE table_name = 'exam_question_submissions' ORDER BY ordinal_position`;
        const columnNames = result.map((row) => row.column_name);
        expect(columnNames).toContain('id');
        expect(columnNames).toContain('exam_session_id');
        expect(columnNames).toContain('exam_id');
        expect(columnNames).toContain('question_id');
        expect(columnNames).toContain('student_id');
        expect(columnNames).toContain('code');
        expect(columnNames).toContain('status');
        expect(columnNames).toContain('score');
        expect(columnNames).toContain('max_score');
        expect(columnNames).toContain('test_results');
        expect(columnNames).toContain('submitted_at');
        expect(columnNames).toContain('updated_at');
      });

      it('should have not null constraints on required fields', async () => {
        const result =
          await client`SELECT column_name FROM information_schema.columns WHERE table_name = 'exam_question_submissions' AND is_nullable = 'NO'`;
        const notNullColumns = result.map((row) => row.column_name);
        expect(notNullColumns).toContain('id');
        expect(notNullColumns).toContain('exam_session_id');
        expect(notNullColumns).toContain('exam_id');
        expect(notNullColumns).toContain('question_id');
        expect(notNullColumns).toContain('student_id');
        expect(notNullColumns).toContain('code');
        expect(notNullColumns).toContain('status');
        expect(notNullColumns).toContain('submitted_at');
        expect(notNullColumns).toContain('updated_at');
      });
    });

    describe('Indexes & Constraints', () => {
      it('should have index on exam_session_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'exam_question_submissions' AND indexname = 'eq_sub_session_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have index on question_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'exam_question_submissions' AND indexname = 'eq_sub_question_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have index on student_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'exam_question_submissions' AND indexname = 'eq_sub_student_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have unique index on exam_session_id + question_id', async () => {
        const result =
          await client`SELECT indexname FROM pg_indexes WHERE tablename = 'exam_question_submissions' AND indexname = 'eq_sub_unique_idx'`;
        expect(result.length).toBe(1);
      });

      it('should have foreign key constraints', async () => {
        const result =
          await client`SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'exam_question_submissions' AND constraint_type = 'FOREIGN KEY'`;
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('Default Values', () => {
      it('should default status to PENDING', async () => {
        const result =
          await client`SELECT column_default FROM information_schema.columns WHERE table_name = 'exam_question_submissions' AND column_name = 'status'`;
        expect(result[0].column_default).toContain('PENDING');
      });

      it('should have default timestamp for submitted_at', async () => {
        const result =
          await client`SELECT column_default FROM information_schema.columns WHERE table_name = 'exam_question_submissions' AND column_name = 'submitted_at'`;
        expect(result[0].column_default).toBeDefined();
        expect(result[0].column_default).toContain('now()');
      });
    });

    describe('Data Operations', () => {
      it('should insert an exam question submission with defaults', async () => {
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        testExamSubmissionId = sub.id;
        expect(sub.id).toBeDefined();
        expect(sub.examSessionId).toBe(testSessionId);
        expect(sub.examId).toBe(testExamId);
        expect(sub.questionId).toBe(testQuestionId);
        expect(sub.studentId).toBe(testStudentId);
        expect(sub.code).toBe('print("hello")');
        expect(sub.status).toBe('PENDING');
        expect(sub.score).toBeNull();
        expect(sub.maxScore).toBeNull();
        expect(sub.testResults).toBeNull();
        expect(sub.submittedAt).toBeDefined();
      });

      it('should insert a completed submission with score and test results', async () => {
        const testResults = JSON.stringify([
          { name: 'Test 1', passed: true, actualOutput: '5', expectedOutput: '5' },
        ]);
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print(2 + 3)',
            status: 'COMPLETED',
            score: 50,
            maxScore: 50,
            testResults,
          })
          .returning();
        testExamSubmissionId = sub.id;
        expect(sub.status).toBe('COMPLETED');
        expect(sub.score).toBe(50);
        expect(sub.maxScore).toBe(50);
        expect(sub.testResults).toBe(testResults);
      });

      it('should enforce unique submission per session per question', async () => {
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        testExamSubmissionId = sub.id;
        await expect(
          db.insert(examQuestionSubmissions).values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("world")',
          })
        ).rejects.toThrow();
      });

      it('should upsert — update existing submission on conflict', async () => {
        const [first] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("v1")',
          })
          .returning();
        testExamSubmissionId = first.id;

        const [updated] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("v2")',
            status: 'RUNNING',
          })
          .onConflictDoUpdate({
            target: [examQuestionSubmissions.examSessionId, examQuestionSubmissions.questionId],
            set: { code: 'print("v2")', status: 'RUNNING', updatedAt: new Date() },
          })
          .returning();

        expect(updated.id).toBe(first.id);
        expect(updated.code).toBe('print("v2")');
        expect(updated.status).toBe('RUNNING');
      });

      it('should update status from RUNNING to COMPLETED', async () => {
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("hello")',
            status: 'RUNNING',
          })
          .returning();
        testExamSubmissionId = sub.id;
        const [updated] = await db
          .update(examQuestionSubmissions)
          .set({ status: 'COMPLETED', score: 50, maxScore: 50, updatedAt: new Date() })
          .where(eq(examQuestionSubmissions.id, sub.id))
          .returning();
        expect(updated.status).toBe('COMPLETED');
        expect(updated.score).toBe(50);
      });

      it('should update status to FAILED', async () => {
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'invalid code',
            status: 'RUNNING',
          })
          .returning();
        testExamSubmissionId = sub.id;
        const [updated] = await db
          .update(examQuestionSubmissions)
          .set({ status: 'FAILED', updatedAt: new Date() })
          .where(eq(examQuestionSubmissions.id, sub.id))
          .returning();
        expect(updated.status).toBe('FAILED');
      });

      it('should cascade delete submissions when exam session is deleted', async () => {
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        await db.delete(examSessions).where(eq(examSessions.id, testSessionId));
        testSessionId = '';
        const found = await db
          .select()
          .from(examQuestionSubmissions)
          .where(eq(examQuestionSubmissions.id, sub.id));
        expect(found.length).toBe(0);
      });

      it('should cascade delete submissions when student is deleted', async () => {
        const [sub] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("hello")',
          })
          .returning();
        await db.delete(examSessions).where(eq(examSessions.id, testSessionId));
        testSessionId = '';
        await db.delete(users).where(eq(users.id, testStudentId));
        testStudentId = '';
        const found = await db
          .select()
          .from(examQuestionSubmissions)
          .where(eq(examQuestionSubmissions.id, sub.id));
        expect(found.length).toBe(0);
      });

      it('should allow the same question to have submissions from different sessions', async () => {
        const [student2] = await db
          .insert(users)
          .values({
            email: `student2-examsub-${Date.now()}@example.com`,
            password: 'Password123',
            name: 'Student 2',
            role: 'STUDENT',
          })
          .returning();
        const [session2] = await db
          .insert(examSessions)
          .values({
            examId: testExamId,
            studentId: student2.id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          })
          .returning();
        const [sub1] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: testSessionId,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: testStudentId,
            code: 'print("s1")',
          })
          .returning();
        testExamSubmissionId = sub1.id;
        const [sub2] = await db
          .insert(examQuestionSubmissions)
          .values({
            examSessionId: session2.id,
            examId: testExamId,
            questionId: testQuestionId,
            studentId: student2.id,
            code: 'print("s2")',
          })
          .returning();
        expect(sub1.studentId).not.toBe(sub2.studentId);
        expect(sub1.questionId).toBe(sub2.questionId);
        await db.delete(examQuestionSubmissions).where(eq(examQuestionSubmissions.id, sub2.id));
        await db.delete(examSessions).where(eq(examSessions.id, session2.id));
        await db.delete(users).where(eq(users.id, student2.id));
      });
    });
  });
});
