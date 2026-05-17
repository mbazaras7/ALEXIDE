/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const setupMinIO = async () => {
  const s3Client = new S3Client({
    region: 'us-west-1',
    endpoint: process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'alexide_admin',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'alexide_secret_123',
    },
    forcePathStyle: true,
  });

  const bucketName = process.env.S3_BUCKET_NAME || 'alexide-files';

  try {
    //Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket '${bucketName}' already exists`);
  } catch (error: any) {
    if (error.name === 'NotFound') {
      //Create bucket
      await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`Created bucket '${bucketName}'`);
    } else {
      console.error('Error checking bucket:', error);
      throw error;
    }
  }
};

setupMinIO()
  .then(() => {
    console.log('MinIO setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('MinIO setup failed:', error);
    process.exit(1);
  });
