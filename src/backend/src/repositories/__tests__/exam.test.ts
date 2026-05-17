import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { db } from '../../db';
import {
  users,
  classes,
  classMembers,
  exams,
  examQuestions,
  examTestCases,
  examSessions,
} from '../../db/schema';
import { examRepository } from '../exam';
import { eq } from 'drizzle-orm';

describe('ExamRepository', () => {
  let teacherId: string;
  let studentId: string;
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

    const [student] = await db
      .insert(users)
      .values({
        email: `student${Date.now()}@gmail.com`,
        password: 'Password123',
        role: 'STUDENT',
      })
      .returning();
    studentId = student.id;

    const [cls] = await db
      .insert(classes)
      .values({
        name: 'Exam Repo Class',
        teacherId,
        joinCode: `EXAMREPO-${Date.now()}`,
      })
      .returning();
    classId = cls.id;

    await db.insert(classMembers).values({ classId, studentId });
  });

  afterEach(async () => {
    if (classId) {
      const examRows = await db.select().from(exams).where(eq(exams.classId, classId));
      for (const exam of examRows) {
        await db.delete(examSessions).where(eq(examSessions.examId, exam.id));
        const questionRows = await db
          .select()
          .from(examQuestions)
          .where(eq(examQuestions.examId, exam.id));
        for (const q of questionRows) {
          await db.delete(examTestCases).where(eq(examTestCases.questionId, q.id));
        }
        await db.delete(examQuestions).where(eq(examQuestions.examId, exam.id));
      }
      await db.delete(exams).where(eq(exams.classId, classId));
    }
  });

  afterAll(async () => {
    if (classId) {
      await db.delete(classMembers).where(eq(classMembers.classId, classId));
      await db.delete(classes).where(eq(classes.id, classId));
    }
    if (studentId) {
      await db.delete(users).where(eq(users.id, studentId));
    }
    if (teacherId) {
      await db.delete(users).where(eq(users.id, teacherId));
    }
  });

  describe('create', () => {
    it('should create an exam with defaults', async () => {
      const result = await examRepository.create({
        classId,
        teacherId,
        title: 'Test Exam',
      });

      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Exam');
      expect(result.status).toBe('DRAFT');
      expect(result.language).toBe('python');
      expect(result.durationMinutes).toBe(60);
      expect(result.maxScore).toBe(100);
      expect(result.instructions).toBeNull();
      expect(result.scheduledStart).toBeNull();
      expect(result.scheduledEnd).toBeNull();
    });

    it('should create an exam with all fields', async () => {
      const start = new Date(Date.now() + 86400000);
      const end = new Date(Date.now() + 90000000);

      const result = await examRepository.create({
        classId,
        teacherId,
        title: 'Full Exam',
        instructions: 'Read carefully',
        language: 'python',
        durationMinutes: 90,
        scheduledStart: start,
        scheduledEnd: end,
        maxScore: 200,
        status: 'SCHEDULED',
      });

      expect(result.instructions).toBe('Read carefully');
      expect(result.durationMinutes).toBe(90);
      expect(result.maxScore).toBe(200);
      expect(result.status).toBe('SCHEDULED');
      expect(result.scheduledStart).toBeInstanceOf(Date);
      expect(result.scheduledEnd).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('should find an exam by id', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Find Me' });

      const found = await examRepository.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await examRepository.findById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('findByIdAndTeacher', () => {
    it('should find an exam owned by the teacher', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Owned Exam' });

      const found = await examRepository.findByIdAndTeacher(created.id, teacherId);
      expect(found).not.toBeNull();
      expect(found!.teacherId).toBe(teacherId);
    });

    it('should return null if teacher does not own the exam', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Not Yours' });

      const found = await examRepository.findByIdAndTeacher(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(found).toBeNull();
    });
  });

  describe('findByIdWithQuestions', () => {
    it('should return exam with empty questions array', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'No Questions' });

      const result = await examRepository.findByIdWithQuestions(created.id);
      expect(result).not.toBeNull();
      expect(result!.questions).toHaveLength(0);
    });

    it('should return null for non-existent exam', async () => {
      const result = await examRepository.findByIdWithQuestions(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBeNull();
    });
  });

  describe('findAllByClass', () => {
    it('should return all exams for a class', async () => {
      await examRepository.create({ classId, teacherId, title: 'E1' });
      await examRepository.create({ classId, teacherId, title: 'E2' });

      const result = await examRepository.findAllByClass(classId);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.every((e) => e.classId === classId)).toBe(true);
    });

    it('should return empty array for class with no exams', async () => {
      const [emptyClass] = await db
        .insert(classes)
        .values({ name: 'Empty', teacherId, joinCode: `EMPTYEXAM-${Date.now()}` })
        .returning();

      const result = await examRepository.findAllByClass(emptyClass.id);
      expect(result).toHaveLength(0);

      await db.delete(classes).where(eq(classes.id, emptyClass.id));
    });
  });

  describe('findAllByClassAndTeacher', () => {
    it('should only return exams for the correct teacher', async () => {
      await examRepository.create({ classId, teacherId, title: 'Mine' });

      const result = await examRepository.findAllByClassAndTeacher(classId, teacherId);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((e) => e.teacherId === teacherId)).toBe(true);
    });

    it('should return empty array for wrong teacher', async () => {
      await examRepository.create({ classId, teacherId, title: 'Not Yours' });

      const result = await examRepository.findAllByClassAndTeacher(
        classId,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should update the title', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Old Title' });

      const updated = await examRepository.update(created.id, teacherId, { title: 'New Title' });
      expect(updated!.title).toBe('New Title');
    });

    it('should update status to ACTIVE', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Draft Exam' });

      const updated = await examRepository.update(created.id, teacherId, { status: 'ACTIVE' });
      expect(updated!.status).toBe('ACTIVE');
    });

    it('should clear scheduledStart when set to null', async () => {
      const created = await examRepository.create({
        classId,
        teacherId,
        title: 'Scheduled',
        scheduledStart: new Date(Date.now() + 86400000),
      });

      const updated = await examRepository.update(created.id, teacherId, {
        scheduledStart: null,
      });
      expect(updated!.scheduledStart).toBeNull();
    });

    it('should return null if teacher does not own the exam', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Protected' });

      const updated = await examRepository.update(
        created.id,
        '00000000-0000-0000-0000-000000000000',
        { title: 'Stolen' }
      );
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an exam and return true', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Delete Me' });

      const result = await examRepository.delete(created.id, teacherId);
      expect(result).toBe(true);

      const found = await examRepository.findById(created.id);
      expect(found).toBeNull();
    });

    it('should return false if exam not found', async () => {
      const result = await examRepository.delete('00000000-0000-0000-0000-000000000000', teacherId);
      expect(result).toBe(false);
    });

    it('should return false if teacher does not own the exam', async () => {
      const created = await examRepository.create({ classId, teacherId, title: 'Protected Del' });

      const result = await examRepository.delete(
        created.id,
        '00000000-0000-0000-0000-000000000000'
      );
      expect(result).toBe(false);
    });
  });

  describe('addQuestion', () => {
    it('should add a question with defaults', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Q Test' });

      const q = await examRepository.addQuestion({
        examId: exam.id,
        title: 'What is 2+2?',
      });

      expect(q.id).toBeDefined();
      expect(q.title).toBe('What is 2+2?');
      expect(q.description).toBeNull();
      expect(q.maxScore).toBe(100);
      expect(q.language).toBe('python');
      expect(q.orderIndex).toBe(0);
    });

    it('should add a question with all fields', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Q Full' });

      const q = await examRepository.addQuestion({
        examId: exam.id,
        title: 'Write a sort function',
        description: 'Sort a list of integers',
        maxScore: 50,
        language: 'python',
        orderIndex: 2,
      });

      expect(q.description).toBe('Sort a list of integers');
      expect(q.maxScore).toBe(50);
      expect(q.orderIndex).toBe(2);
    });
  });

  describe('findQuestionById', () => {
    it('should find a question by id', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Q Find' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Find Me' });

      const found = await examRepository.findQuestionById(q.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(q.id);
    });

    it('should return null for non-existent question', async () => {
      const found = await examRepository.findQuestionById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });

  describe('updateQuestion', () => {
    it('should update question title', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Q Update' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Old Q Title' });

      const updated = await examRepository.updateQuestion(q.id, { title: 'New Q Title' });
      expect(updated!.title).toBe('New Q Title');
    });

    it('should update maxScore', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Q Score' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Scored Q' });

      const updated = await examRepository.updateQuestion(q.id, { maxScore: 25 });
      expect(updated!.maxScore).toBe(25);
    });

    it('should return null for non-existent question', async () => {
      const updated = await examRepository.updateQuestion('00000000-0000-0000-0000-000000000000', {
        title: 'Ghost',
      });
      expect(updated).toBeNull();
    });
  });

  describe('deleteQuestion', () => {
    it('should delete a question and return true', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Q Delete' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Delete Me' });

      const result = await examRepository.deleteQuestion(q.id);
      expect(result).toBe(true);

      const found = await examRepository.findQuestionById(q.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent question', async () => {
      const result = await examRepository.deleteQuestion('00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });

  describe('addTestCase', () => {
    it('should add a test case with defaults', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Test' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });

      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Should return 4',
        expectedOutput: '4',
      });

      expect(tc.id).toBeDefined();
      expect(tc.name).toBe('Should return 4');
      expect(tc.expectedOutput).toBe('4');
      expect(tc.weight).toBe(1);
      expect(tc.orderIndex).toBe(0);
      expect(tc.inputData).toBeNull();
      expect(tc.sysArgs).toBeNull();
    });

    it('should add a test case with all fields', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Full' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });

      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Full test case',
        inputData: '5 10',
        expectedOutput: '15',
        weight: 3,
        orderIndex: 2,
      });

      expect(tc.inputData).toBe('5 10');
      expect(tc.weight).toBe(3);
      expect(tc.orderIndex).toBe(2);
    });

    it('should add a test case with sysArgs', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC SysArgs' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });

      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Args test',
        expectedOutput: 'hello world',
        sysArgs: ['hello', 'world'],
      });

      expect(tc.sysArgs).toEqual(['hello', 'world']);
    });

    it('should add a test case with both inputData and sysArgs', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Both' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });

      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Both inputs',
        inputData: 'stdin data',
        expectedOutput: 'output',
        sysArgs: ['--flag', 'value'],
      });

      expect(tc.inputData).toBe('stdin data');
      expect(tc.sysArgs).toEqual(['--flag', 'value']);
    });
  });

  describe('updateTestCase', () => {
    it('should update test case name', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Update' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });
      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Old Name',
        expectedOutput: 'out',
      });

      const updated = await examRepository.updateTestCase(tc.id, { name: 'New Name' });
      expect(updated!.name).toBe('New Name');
    });

    it('should update expectedOutput', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Output' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });
      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Output Test',
        expectedOutput: 'old output',
      });

      const updated = await examRepository.updateTestCase(tc.id, {
        expectedOutput: 'new output',
      });
      expect(updated!.expectedOutput).toBe('new output');
    });

    it('should update sysArgs', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC SysArgs Update' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });
      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Args update',
        expectedOutput: 'out',
      });

      const updated = await examRepository.updateTestCase(tc.id, { sysArgs: ['new-arg'] });
      expect(updated!.sysArgs).toEqual(['new-arg']);
    });

    it('should clear sysArgs when set to null', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Clear Args' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });
      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Clear args',
        expectedOutput: 'out',
        sysArgs: ['to-be-cleared'],
      });

      const updated = await examRepository.updateTestCase(tc.id, { sysArgs: null });
      expect(updated!.sysArgs).toBeNull();
    });

    it('should return null for non-existent test case', async () => {
      const updated = await examRepository.updateTestCase('00000000-0000-0000-0000-000000000000', {
        name: 'Ghost',
      });
      expect(updated).toBeNull();
    });
  });

  describe('deleteTestCase', () => {
    it('should delete a test case and return true', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'TC Delete' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });
      const tc = await examRepository.addTestCase({
        questionId: q.id,
        name: 'Delete me',
        expectedOutput: 'bye',
      });

      const result = await examRepository.deleteTestCase(tc.id);
      expect(result).toBe(true);
    });

    it('should return false for non-existent test case', async () => {
      const result = await examRepository.deleteTestCase('00000000-0000-0000-0000-000000000000');
      expect(result).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create an exam session', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Session Test' });
      const expiresAt = new Date(Date.now() + 3600000);

      const session = await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt,
      });

      expect(session.id).toBeDefined();
      expect(session.examId).toBe(exam.id);
      expect(session.studentId).toBe(studentId);
      expect(session.isSubmitted).toBe(false);
      expect(session.tabSwitchCount).toBe(0);
      expect(session.submittedAt).toBeNull();
      expect(session.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('findSessionByExamAndStudent', () => {
    it('should find a session by exam and student', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Find Session' });
      const expiresAt = new Date(Date.now() + 3600000);
      await examRepository.createSession({ examId: exam.id, studentId, expiresAt });

      const found = await examRepository.findSessionByExamAndStudent(exam.id, studentId);
      expect(found).not.toBeNull();
      expect(found!.examId).toBe(exam.id);
      expect(found!.studentId).toBe(studentId);
    });

    it('should return null if no session exists', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'No Session' });

      const found = await examRepository.findSessionByExamAndStudent(exam.id, studentId);
      expect(found).toBeNull();
    });
  });

  describe('updateSession', () => {
    it('should mark session as submitted', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Submit Session' });
      const expiresAt = new Date(Date.now() + 3600000);
      await examRepository.createSession({ examId: exam.id, studentId, expiresAt });

      const submittedAt = new Date();
      const updated = await examRepository.updateSession(exam.id, studentId, {
        isSubmitted: true,
        submittedAt,
      });

      expect(updated!.isSubmitted).toBe(true);
      expect(updated!.submittedAt).toBeInstanceOf(Date);
    });

    it('should increment tabSwitchCount', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'Tab Switch' });
      const expiresAt = new Date(Date.now() + 3600000);
      await examRepository.createSession({ examId: exam.id, studentId, expiresAt });

      const updated = await examRepository.updateSession(exam.id, studentId, {
        tabSwitchCount: 3,
      });

      expect(updated!.tabSwitchCount).toBe(3);
    });

    it('should return null if session does not exist', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'No Sess Update' });

      const updated = await examRepository.updateSession(exam.id, studentId, {
        tabSwitchCount: 1,
      });
      expect(updated).toBeNull();
    });
  });

  describe('findActiveSessionsByExam', () => {
    it('should return only non-submitted, non-expired sessions for an exam', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Active Sessions Test',
        durationMinutes: 60,
      });

      await examRepository.createSession({
        //active
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const results = await examRepository.findActiveSessionsByExam(exam.id);
      expect(results.length).toBe(1);
      expect(results[0].isSubmitted).toBe(false);
      expect(results[0].examId).toBe(exam.id);
    });

    it('should not return submitted sessions', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Submitted Sessions Excluded',
        durationMinutes: 60,
      });

      const session = await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await examRepository.updateSession(exam.id, studentId, {
        isSubmitted: true,
        submittedAt: new Date(),
      });

      const results = await examRepository.findActiveSessionsByExam(exam.id);
      expect(results.every((s) => s.id !== session.id)).toBe(true);
    });

    it('should not return expired sessions', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Expired Sessions Excluded',
        durationMinutes: 1,
      });

      await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() - 1000), //expired
      });

      const results = await examRepository.findActiveSessionsByExam(exam.id);
      expect(results).toHaveLength(0);
    });

    it('should return empty array for exam with no sessions', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'No Sessions Exam',
        durationMinutes: 60,
      });

      const results = await examRepository.findActiveSessionsByExam(exam.id);
      expect(results).toHaveLength(0);
    });

    it('should return empty array for non-existent exam', async () => {
      const results = await examRepository.findActiveSessionsByExam(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(results).toHaveLength(0);
    });
  });

  describe('findActiveSessionsByStudent', () => {
    it('should return active (non-submitted) sessions for a student', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Active Student Session',
        durationMinutes: 60,
      });

      await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const results = await examRepository.findActiveSessionsByStudent(studentId);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((s) => s.studentId === studentId)).toBe(true);
      expect(results.every((s) => s.isSubmitted === false)).toBe(true);
    });

    it('should not return submitted sessions', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Submitted Student Session',
        durationMinutes: 60,
      });

      await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });

      await examRepository.updateSession(exam.id, studentId, {
        isSubmitted: true,
        submittedAt: new Date(),
      });

      const results = await examRepository.findActiveSessionsByStudent(studentId);
      const thisExamSessions = results.filter((s) => s.examId === exam.id);
      expect(thisExamSessions).toHaveLength(0);
    });

    it('should return sessions across multiple active exams for the same student', async () => {
      const exam1 = await examRepository.create({
        classId,
        teacherId,
        title: 'Multi Exam 1',
        durationMinutes: 60,
      });
      const exam2 = await examRepository.create({
        classId,
        teacherId,
        title: 'Multi Exam 2',
        durationMinutes: 60,
      });

      await examRepository.createSession({
        examId: exam1.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });
      await examRepository.createSession({
        examId: exam2.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const results = await examRepository.findActiveSessionsByStudent(studentId);
      const examIds = results.map((s) => s.examId);
      expect(examIds).toContain(exam1.id);
      expect(examIds).toContain(exam2.id);
    });

    it('should not return sessions belonging to a different student', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Other Student Session',
        durationMinutes: 60,
      });

      await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const results = await examRepository.findActiveSessionsByStudent(
        '00000000-0000-0000-0000-000000000000'
      );
      const thisExamSessions = results.filter((s) => s.examId === exam.id);
      expect(thisExamSessions).toHaveLength(0);
    });

    it('should return empty array for student with no sessions', async () => {
      const results = await examRepository.findActiveSessionsByStudent(
        '00000000-0000-0000-0000-000000000000'
      );
      expect(results).toHaveLength(0);
    });

    it('should include expired but unsubmitted sessions', async () => {
      const exam = await examRepository.create({
        classId,
        teacherId,
        title: 'Expired Unsubmitted',
        durationMinutes: 1,
      });

      await examRepository.createSession({
        examId: exam.id,
        studentId,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      const results = await examRepository.findActiveSessionsByStudent(studentId);
      const thisExamSessions = results.filter((s) => s.examId === exam.id);
      expect(thisExamSessions).toHaveLength(1);
      expect(thisExamSessions[0].isSubmitted).toBe(false);
    });
  });

  describe('sysArgs serialisation', () => {
    it('should persist and retrieve sysArgs as a parsed array not a raw string', async () => {
      const exam = await examRepository.create({ classId, teacherId, title: 'SysArgs Parse' });
      const q = await examRepository.addQuestion({ examId: exam.id, title: 'Q' });

      await examRepository.addTestCase({
        questionId: q.id,
        name: 'Parsed args',
        expectedOutput: 'out',
        sysArgs: ['a', 'b', 'c'],
      });

      const result = await examRepository.findByIdWithQuestions(exam.id);
      const tc = result!.questions[0].testCases[0];

      expect(Array.isArray(tc.sysArgs)).toBe(true);
      expect(tc.sysArgs).toEqual(['a', 'b', 'c']);
    });
  });
});
