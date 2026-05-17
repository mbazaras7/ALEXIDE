/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

class StorageService {
  private readonly isProduction = process.env.NODE_ENV === 'production';
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || 'alexide-files';

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: this.isProduction
        ? undefined
        : process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000',
      credentials: {
        accessKeyId: this.isProduction
          ? process.env.AWS_ACCESS_KEY_ID || ''
          : process.env.MINIO_ACCESS_KEY || 'alexide_admin',
        secretAccessKey: this.isProduction
          ? process.env.AWS_SECRET_ACCESS_KEY || ''
          : process.env.MINIO_SECRET_KEY || 'alexide_secret_123',
      },
      forcePathStyle: !this.isProduction, // Required for MinIO
    });
  }

  async uploadFile(
    key: string,
    content: Buffer | string,
    mimeType: string = 'text/plain'
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: content,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);
      return this.getFileUrl(key);
    } catch (error) {
      console.error('Upload failed:', error);
      throw new Error(`Failed to upload file: ${key}`);
    }
  }

  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      //Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as Readable) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error(`Failed to download file: ${key}`);
    }
  }

  //for large files
  async downloadFileStream(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      return response.Body as Readable;
    } catch (error) {
      console.error('Stream download failed:', error);
      throw new Error(`Failed to download file stream: ${key}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Delete failed:', error);
      throw new Error(`Failed to delete file: ${key}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength ?? 0,
        lastModified: response.LastModified ?? new Date(),
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  private getFileUrl(key: string): string {
    if (this.isProduction) {
      return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }
    return `${process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000'}/${this.bucketName}/${key}`;
  }

  generateKey(userId: string, filePath: string): string {
    const sanitizedPath = filePath.replace(/^\/+/, '').replace(/\/+/g, '/');
    return `users/${userId}/${sanitizedPath}`;
  }
}

export const storageService = new StorageService();
