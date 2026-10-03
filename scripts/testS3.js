import "dotenv/config";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.AWS_S3_BUCKET;

for (const prefix of ["credentials", "course-materials"]) {
  const Key = `${prefix}/_healthcheck-${Date.now()}.txt`;
  try {
    await s3.send(new PutObjectCommand({ Bucket, Key, Body: "ok" }));
    await s3.send(new GetObjectCommand({ Bucket, Key }));
    await s3.send(new DeleteObjectCommand({ Bucket, Key }));
    console.log(`${prefix}: put/get/delete OK`);
  } catch (e) {
    console.log(`${prefix}: FAILED - ${e.name}: ${e.message}`);
  }
}