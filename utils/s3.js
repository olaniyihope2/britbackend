import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.AWS_S3_BUCKET;

export const uploadToS3 = async (file, folder = "credentials") => {
  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
  await s3.send(new PutObjectCommand({
    Bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ServerSideEncryption: "AES256",
  }));
  return key;
};

export const deleteFromS3 = (key) =>
  s3.send(new DeleteObjectCommand({ Bucket, Key: key })).catch((e) => console.error("S3 delete failed:", e));

export const getDownloadUrl = (key, fileName) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    }),
    { expiresIn: 300 } // 5 minutes
  );