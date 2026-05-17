import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import { users, classes, assignments } from '../../db/schema';
import { assignmentRepository } from '../assignment';
import { eq } from 'drizzle-orm';

describe('AssignmentRepository', () => {
  let teacherId: string;
  let classId: string;

  beforeAll(async () => {
    const [teacher] = await db
      .insert(users)
      .values({
        email: `teacher${Date.now()}@gmail.com`,
        password: 'Password123',
        role: 'TEACHER',
      })
      .returning();
    teacherId = teacher.id;

    const [cls] = await db
      .insert(classes)
      .values({
        name: 'Repo Class',
        teacherId,
        joinCode: `ASGNREPO-${Date.now()}`,
      })
      .returning();
    classId = cls.id;
  });

  afterEach(async () => {
    if (classId) {
      await db.delete(assignments).where(eq(assignments.classId, classId));
    }
  });

  afterAll(async () => {
    if (classId) {
      await db.delete(classes).where(eq(classes.id, classId));
    }
    if (teacherId) {
      await db.delete(users).where(eq(users.id, teacherId));
    }
  });

  describe('create', () => {
    it('should create an assignment with defaults', async () => {
      const result = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Test Assignment',
      });

      expect(result.title).toBe('Test Assignment');
      expect(result.status).toBe('DRAFT');
      expect(result.maxScore).toBe(100);
      expect(result.language).toBe('python');
      expect(result.dueDate).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should create an assignment with all fields', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Full Assignment',
        description: 'Full description',
        dueDate,
        maxScore: 50,
        language: 'python',
        status: 'PUBLISHED',
      });

      expect(result.description).toBe('Full description');
      expect(result.maxScore).toBe(50);
      expect(result.status).toBe('PUBLISHED');
      expect(result.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('should find an assignment by id', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Find Me',
      });

      const found = await assignmentRepository.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await assignmentRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByIdAndTeacher', () => {
    it('should find assignment owned by teacher', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Owned',
      });

      const found = await assignmentRepository.findByIdAndTeacher(created.id, teacherId);
      expect(found).not.toBeNull();
    });

    it('should return null if teacher does not own assignment', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Not Yours',
      });

      const found = await assignmentRepository.findByIdAndTeacher(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });
  });

  describe('findByIdWithTestCases', () => {
    it('should return assignment with empty test cases array', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'No Test Cases',
      });

      const result = await assignmentRepository.findByIdWithTestCases(created.id);
      expect(result).not.toBeNull();
      expect(result!.testCases).toHaveLength(0);
    });

    it('should return assignment with test cases ordered by orderIndex', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'With Test Cases',
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC 2',
        expectedOutput: 'out2',
        orderIndex: 1,
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC 1',
        expectedOutput: 'out1',
        orderIndex: 0,
      });

      const result = await assignmentRepository.findByIdWithTestCases(created.id);
      expect(result!.testCases).toHaveLength(2);
      expect(result!.testCases[0].name).toBe('TC 1');
      expect(result!.testCases[1].name).toBe('TC 2');
    });
  });

  describe('findByIdWithTestCasesAndTeacher', () => {
    it('should return assignment with test cases for correct teacher', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Teacher Check',
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC',
        expectedOutput: 'out',
      });

      const result = await assignmentRepository.findByIdWithTestCasesAndTeacher(
        created.id,
        teacherId
      );
      expect(result).not.toBeNull();
      expect(result!.testCases).toHaveLength(1);
    });

    it('should return null for wrong teacher', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Wrong Teacher',
      });

      const result = await assignmentRepository.findByIdWithTestCasesAndTeacher(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });
  });

  describe('findAllByClass', () => {
    it('should return all assignments for a class', async () => {
      await assignmentRepository.create({ classId, teacherId, title: 'A1' });
      await assignmentRepository.create({ classId, teacherId, title: 'A2' });

      const result = await assignmentRepository.findAllByClass(classId);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for class with no assignments', async () => {
      const [emptyClass] = await db
        .insert(classes)
        .values({ name: 'Empty', teacherId, joinCode: `EMPTY-${Date.now()}` })
        .returning();

      const result = await assignmentRepository.findAllByClass(emptyClass.id);
      expect(result).toHaveLength(0);

      await db.delete(classes).where(eq(classes.id, emptyClass.id));
    });
  });

  describe('findAllByClassAndTeacher', () => {
    it('should only return assignments for the correct teacher', async () => {
      await assignmentRepository.create({ classId, teacherId, title: 'Mine' });

      const result = await assignmentRepository.findAllByClassAndTeacher(classId, teacherId);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((a) => a.teacherId === teacherId)).toBe(true);
    });

    it('should return empty array for wrong teacher', async () => {
      await assignmentRepository.create({ classId, teacherId, title: 'Not Yours' });

      const result = await assignmentRepository.findAllByClassAndTeacher(
        classId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update title', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Old Title',
      });

      const updated = await assignmentRepository.update(created.id, teacherId, {
        title: 'New Title',
      });
      expect(updated!.title).toBe('New Title');
    });

    it('should update status to PUBLISHED', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Draft',
      });

      const updated = await assignmentRepository.update(created.id, teacherId, {
        status: 'PUBLISHED',
      });
      expect(updated!.status).toBe('PUBLISHED');
    });

    it('should clear due date when set to null', async () => {
      const dueDate = new Date(Date.now() + 86400000);
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Has Due Date',
        dueDate,
      });

      const updated = await assignmentRepository.update(created.id, teacherId, { dueDate: null });
      expect(updated!.dueDate).toBeNull();
    });

    it('should return null if teacher does not own assignment', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Protected',
      });

      const updated = await assignmentRepository.update(
        created.id,
        '00000000-0000-0000-0000-000000000000',
        { title: 'Stolen' }
      );
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an assignment and return true', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Delete Me',
      });

      const result = await assignmentRepository.delete(created.id, teacherId);
      expect(result).toBe(true);

      const found = await assignmentRepository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false if assignment not found', async () => {
      const result = await assignmentRepository.delete(
        '00000000-0000-0000-0000-000000000000',
        teacherId
      );
      expect(result).toBe(false);
    });
  });

  describe('addTestCase', () => {
    it('should add a test case with defaults', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'TC Test',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Should print hello',
        expectedOutput: 'hello',
      });

      expect(tc.id).toBeDefined();
      expect(tc.name).toBe('Should print hello');
      expect(tc.expectedOutput).toBe('hello');
      expect(tc.weight).toBe(1);
      expect(tc.orderIndex).toBe(0);
      expect(tc.inputData).toBeNull();
      expect(tc.sysArgs).toBeNull();
    });

    it('should add a test case with all fields', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'TC Full',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Full test case',
        inputData: '5 10',
        expectedOutput: '15',
        weight: 3,
        orderIndex: 2,
      });

      expect(tc.inputData).toBe('5 10');
      expect(tc.expectedOutput).toBe('15');
      expect(tc.weight).toBe(3);
      expect(tc.orderIndex).toBe(2);
      expect(tc.sysArgs).toBeNull();
    });

    it('should add a test case with sysArgs', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'TC SysArgs',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Args test',
        expectedOutput: 'hello world',
        sysArgs: ['hello', 'world'],
      });

      expect(tc.sysArgs).toEqual(['hello', 'world']);
    });

    it('should add a test case with both inputData and sysArgs', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'TC Both',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Both inputs',
        inputData: 'stdin data',
        expectedOutput: 'output',
        sysArgs: ['--flag', 'value'],
      });

      expect(tc.inputData).toBe('stdin data');
      expect(tc.sysArgs).toEqual(['--flag', 'value']);
    });
  });

  describe('findTestCaseById', () => {
    it('should find a test case by id', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Find TC',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Find me',
        expectedOutput: 'found',
      });

      const found = await assignmentRepository.findTestCaseById(tc.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(tc.id);
    });

    it('should return null for non-existent test case', async () => {
      const found = await assignmentRepository.findTestCaseById(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });
  });

  describe('findTestCasesByAssignment', () => {
    it('should return all test cases for an assignment', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Multi TC',
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC A',
        expectedOutput: 'a',
        orderIndex: 0,
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC B',
        expectedOutput: 'b',
        orderIndex: 1,
      });

      const cases = await assignmentRepository.findTestCasesByAssignment(created.id);
      expect(cases).toHaveLength(2);
      expect(cases[0].orderIndex).toBeLessThanOrEqual(cases[1].orderIndex);
    });

    it('should return empty array if no test cases', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'No TC',
      });

      const cases = await assignmentRepository.findTestCasesByAssignment(created.id);
      expect(cases).toHaveLength(0);
    });

    it('should return sysArgs as parsed array not raw string', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'SysArgs Parse Check',
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Parsed args',
        expectedOutput: 'out',
        sysArgs: ['a', 'b'],
      });

      const cases = await assignmentRepository.findTestCasesByAssignment(created.id);
      expect(Array.isArray(cases[0].sysArgs)).toBe(true);
      expect(cases[0].sysArgs).toEqual(['a', 'b']);
    });
  });

  describe('updateTestCase', () => {
    it('should update test case name', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Update TC',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Old Name',
        expectedOutput: 'out',
      });

      const updated = await assignmentRepository.updateTestCase(tc.id, { name: 'New Name' });
      expect(updated!.name).toBe('New Name');
    });

    it('should update expected output', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Update Output',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Output Test',
        expectedOutput: 'old output',
      });

      const updated = await assignmentRepository.updateTestCase(tc.id, {
        expectedOutput: 'new output',
      });
      expect(updated!.expectedOutput).toBe('new output');
    });

    it('should update sysArgs', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Update SysArgs',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Args update',
        expectedOutput: 'out',
      });

      const updated = await assignmentRepository.updateTestCase(tc.id, {
        sysArgs: ['new-arg'],
      });

      expect(updated!.sysArgs).toEqual(['new-arg']);
    });

    it('should clear sysArgs when set to null', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Clear SysArgs',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Clear args',
        expectedOutput: 'out',
        sysArgs: ['to-be-cleared'],
      });

      const updated = await assignmentRepository.updateTestCase(tc.id, { sysArgs: null });
      expect(updated!.sysArgs).toBeNull();
    });

    it('should return null for non-existent test case', async () => {
      const updated = await assignmentRepository.updateTestCase(
        '00000000-0000-0000-0000-000000000000',
        { name: 'Ghost' }
      );
      expect(updated).toBeNull();
    });
  });

  describe('deleteTestCase', () => {
    it('should delete a test case and return true', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Del TC',
      });

      const tc = await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'Delete me',
        expectedOutput: 'bye',
      });

      const result = await assignmentRepository.deleteTestCase(tc.id);
      expect(result).toBe(true);

      const found = await assignmentRepository.findTestCaseById(tc.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent test case', async () => {
      const result = await assignmentRepository.deleteTestCase(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBe(false);
    });
  });

  describe('deleteAllTestCases', () => {
    it('should delete all test cases for an assignment and return count', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Del All TC',
      });

      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC 1',
        expectedOutput: 'a',
      });
      await assignmentRepository.addTestCase({
        assignmentId: created.id,
        name: 'TC 2',
        expectedOutput: 'b',
      });

      const count = await assignmentRepository.deleteAllTestCases(created.id);
      expect(count).toBe(2);

      const remaining = await assignmentRepository.findTestCasesByAssignment(created.id);
      expect(remaining).toHaveLength(0);
    });
  });

  describe('findAllByClassWithClassName', () => {
    it('should return assignments with className for a class', async () => {
      await assignmentRepository.create({ classId, teacherId, title: 'Repo A1' });
      await assignmentRepository.create({ classId, teacherId, title: 'Repo A2' });

      const result = await assignmentRepository.findAllByClassWithClassName(classId);

      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((a) => a.classId === classId)).toBe(true);
      expect(result.every((a) => a.className === 'Repo Class')).toBe(true);
    });

    it('should return empty array for class with no assignments', async () => {
      const [emptyClass] = await db
        .insert(classes)
        .values({ name: 'Empty Repo Class', teacherId, joinCode: `EMPTYREPO-${Date.now()}` })
        .returning();

      const result = await assignmentRepository.findAllByClassWithClassName(emptyClass.id);

      expect(result).toHaveLength(0);

      await db.delete(classes).where(eq(classes.id, emptyClass.id));
    });
  });

  describe('findIdsByClass', () => {
    it('should return an array of assignment IDs for a class', async () => {
      const a1 = await assignmentRepository.create({ classId, teacherId, title: 'IDs Test 1' });
      const a2 = await assignmentRepository.create({ classId, teacherId, title: 'IDs Test 2' });

      const ids = await assignmentRepository.findIdsByClass(classId);

      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain(a1.id);
      expect(ids).toContain(a2.id);
      ids.forEach((id) => expect(typeof id).toBe('string'));
    });

    it('should return only IDs, not full assignment objects', async () => {
      await assignmentRepository.create({ classId, teacherId, title: 'IDs Only Check' });

      const ids = await assignmentRepository.findIdsByClass(classId);

      ids.forEach((id) => {
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should return empty array for a class with no assignments', async () => {
      const [emptyClass] = await db
        .insert(classes)
        .values({ name: 'Empty IDs Class', teacherId, joinCode: `EMPTYIDS-${Date.now()}` })
        .returning();

      const ids = await assignmentRepository.findIdsByClass(emptyClass.id);
      expect(ids).toEqual([]);

      await db.delete(classes).where(eq(classes.id, emptyClass.id));
    });
  });

  describe('findByIdAndClass', () => {
    it('should return the assignment when ID and classId match', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'By ID And Class',
      });

      const found = await assignmentRepository.findByIdAndClass(created.id, classId);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.classId).toBe(classId);
    });

    it('should return null when assignment exists but belongs to a different class', async () => {
      const created = await assignmentRepository.create({
        classId,
        teacherId,
        title: 'Wrong Class Check',
      });

      const found = await assignmentRepository.findByIdAndClass(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );

      expect(found).toBeNull();
    });

    it('should return null for a non-existent assignment ID', async () => {
      const found = await assignmentRepository.findByIdAndClass(
        '00000000-0000-0000-0000-000000000000',
        classId
      );

      expect(found).toBeNull();
    });

    it('should return null when both ID and classId are non-existent', async () => {
      const found = await assignmentRepository.findByIdAndClass(
        '00000000-0000-0000-0000-000000000000',
        '00000000-0000-0000-0000-000000000001'
      );

      expect(found).toBeNull();
    });
  });
});
