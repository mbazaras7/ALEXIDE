export interface ClassData {
  id: string;
  name: string;
  description: string | null;
  teacherId: string;
  joinCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassWithMemberCount extends ClassData {
  memberCount: number;
}

export interface ClassWithMembers extends ClassData {
  members: ClassMemberData[];
}

export interface StudentInfo {
  id: string;
  name: string | null;
  email: string;
}

export interface StudentsInfo extends StudentInfo {
  joinedAt: Date;
}

export interface ClassMemberData {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: Date;
  student: StudentInfo;
}

export interface CreateClassRequest {
  name: string;
  description?: string;
}

export interface UpdateClassRequest {
  name?: string;
  description?: string;
}

export interface StudentClassData {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: Date;
  class: ClassData;
}

export interface ClassStudentList {
  classId: string;
  studentCount: number;
  students: StudentsInfo[];
}
