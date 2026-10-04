import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/* !! ADAPT the env var names below to the ones your utils/s3.js uses !! */
const BUCKET = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME;

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Browser uploads the recording straight to S3 (large files never touch our server)
export const getUploadUrl = (key, contentType, expiresIn = 60 * 60 * 3) =>
  getSignedUrl(client, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), {
    expiresIn,
  });

// Inline playback URL for <video> (no forced-download header)
export const getStreamUrl = (key, expiresIn = 60 * 60 * 4) =>
  getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });

export const headObject = async (key) => {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    return null;
  }
};
