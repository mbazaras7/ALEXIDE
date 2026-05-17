import { Response } from 'express';

//all API responses follow this consistent structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string }>;
  timestamp: string;
}

// standardizes all API responses across the application
export class ResponseHandler {
  static success<T>(res: Response, data: T, message?: string, statusCode: number = 200) {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message?: string) {
    return this.success(res, data, message, 201);
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    errors?: Array<{ field: string; message: string }>
  ) {
    const response: ApiResponse = {
      success: false,
      error: message,
      errors,
      timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    errors?: Array<{ field: string; message: string }>
  ) {
    return this.error(res, message, 400, errors);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized') {
    return this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = 'Forbidden') {
    return this.error(res, message, 403);
  }

  static notFound(res: Response, message: string = 'Resource not found') {
    return this.error(res, message, 404);
  }

  static conflict(res: Response, message: string = 'Resource already exists') {
    return this.error(res, message, 409);
  }

  static serverError(res: Response, message: string = 'Internal server error') {
    return this.error(res, message, 500);
  }
}
