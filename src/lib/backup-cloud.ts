import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Client as FtpClient } from "basic-ftp";
import SftpClient from "ssh2-sftp-client";
import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream, createWriteStream, statSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { getSettings } from "@/lib/settings";

export type CloudProvider = "s3" | "ftp" | "sftp" | "none";

export interface CloudConfig {
  provider: CloudProvider;
  // S3
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Prefix?: string;
  // FTP / SFTP
  ftpHost?: string;
  ftpPort?: number;
  ftpUser?: string;
  ftpPassword?: string;
  ftpSecure?: boolean;
  ftpPath?: string;
}

const CLOUD_SETTING_KEYS = [
  "cloud_provider",
  "cloud_s3_endpoint",
  "cloud_s3_region",
  "cloud_s3_bucket",
  "cloud_s3_access_key",
  "cloud_s3_secret_key",
  "cloud_s3_prefix",
  "cloud_ftp_host",
  "cloud_ftp_port",
  "cloud_ftp_user",
  "cloud_ftp_password",
  "cloud_ftp_secure",
  "cloud_ftp_path",
];

export { CLOUD_SETTING_KEYS };

export async function getCloudConfig(): Promise<CloudConfig> {
  const map = await getSettings(CLOUD_SETTING_KEYS);

  return {
    provider: (map.cloud_provider as CloudProvider) || "none",
    s3Endpoint: map.cloud_s3_endpoint || "",
    s3Region: map.cloud_s3_region || "us-east-1",
    s3Bucket: map.cloud_s3_bucket || "",
    s3AccessKey: map.cloud_s3_access_key || "",
    s3SecretKey: map.cloud_s3_secret_key || "",
    s3Prefix: map.cloud_s3_prefix || "backups/",
    ftpHost: map.cloud_ftp_host || "",
    ftpPort: parseInt(map.cloud_ftp_port || "21"),
    ftpUser: map.cloud_ftp_user || "",
    ftpPassword: map.cloud_ftp_password || "",
    ftpSecure: map.cloud_ftp_secure === "true",
    ftpPath: map.cloud_ftp_path || "/backups",
  };
}

// ─── S3 ───────────────────────────────────────────────

function createS3Client(config: CloudConfig): S3Client {
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    region: config.s3Region || "us-east-1",
    credentials: {
      accessKeyId: config.s3AccessKey || "",
      secretAccessKey: config.s3SecretKey || "",
    },
  };
  if (config.s3Endpoint) {
    clientConfig.endpoint = config.s3Endpoint;
    clientConfig.forcePathStyle = true; // Required for MinIO, Scaleway, etc.
  }
  return new S3Client(clientConfig);
}

function s3Key(config: CloudConfig, filename: string): string {
  const prefix = (config.s3Prefix || "backups/").replace(/\/$/, "");
  return `${prefix}/${filename}`;
}

async function s3Upload(config: CloudConfig, filepath: string, filename: string): Promise<void> {
  const client = createS3Client(config);
  const stream = createReadStream(filepath);
  const fileSize = statSync(filepath).size;

  await client.send(new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: s3Key(config, filename),
    Body: stream,
    ContentType: "application/gzip",
    ContentLength: fileSize,
  }));
}

async function s3Download(config: CloudConfig, filename: string, destPath: string): Promise<void> {
  const client = createS3Client(config);

  const response = await client.send(new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: s3Key(config, filename),
  }));

  if (!response.Body) throw new Error("Fichier vide sur S3");

  const writeStream = createWriteStream(destPath);
  const readable = response.Body as Readable;

  await new Promise<void>((resolve, reject) => {
    readable.pipe(writeStream);
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
}

async function s3Delete(config: CloudConfig, filename: string): Promise<void> {
  const client = createS3Client(config);
  await client.send(new DeleteObjectCommand({
    Bucket: config.s3Bucket,
    Key: s3Key(config, filename),
  }));
}

async function s3List(config: CloudConfig): Promise<{ name: string; size: number; lastModified: Date }[]> {
  const client = createS3Client(config);
  const prefix = (config.s3Prefix || "backups/").replace(/\/$/, "") + "/";

  const response = await client.send(new ListObjectsV2Command({
    Bucket: config.s3Bucket,
    Prefix: prefix,
  }));

  return (response.Contents || [])
    .filter((obj) => obj.Key?.endsWith(".sql.gz") || obj.Key?.endsWith(".tar.gz"))
    .map((obj) => ({
      name: obj.Key!.split("/").pop()!,
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
}

async function s3TestConnection(config: CloudConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createS3Client(config);
    await client.send(new ListObjectsV2Command({
      Bucket: config.s3Bucket,
      MaxKeys: 1,
    }));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── FTP ──────────────────────────────────────────────

async function withFtpClient<T>(config: CloudConfig, fn: (client: FtpClient) => Promise<T>): Promise<T> {
  const client = new FtpClient();
  client.ftp.verbose = false;
  // Set generous timeouts for large file uploads
  (client.ftp as unknown as Record<string, number>).timeout = 120000;

  try {
    await client.access({
      host: config.ftpHost,
      port: config.ftpPort || 21,
      user: config.ftpUser,
      password: config.ftpPassword,
      secure: config.ftpSecure || false,
      secureOptions: { rejectUnauthorized: false },
    });

    const remotePath = config.ftpPath || "/backups";
    await client.ensureDir(remotePath);
    await client.cd(remotePath);

    return await fn(client);
  } finally {
    client.close();
  }
}

async function ftpUpload(config: CloudConfig, filepath: string, filename: string): Promise<void> {
  // Vérifier que le fichier local existe et n'est pas vide
  const stat = await fs.stat(filepath);
  if (stat.size === 0) throw new Error("Le fichier backup est vide, upload FTP annulé");

  // Use a dedicated FTP client with upload-specific settings
  const client = new FtpClient();
  client.ftp.verbose = false;
  (client.ftp as unknown as Record<string, number>).timeout = 300000;

  try {
    await client.access({
      host: config.ftpHost,
      port: config.ftpPort || 21,
      user: config.ftpUser,
      password: config.ftpPassword,
      secure: config.ftpSecure || false,
      secureOptions: { rejectUnauthorized: false },
    });

    const remotePath = config.ftpPath || "/backups";
    await client.ensureDir(remotePath);
    await client.cd(remotePath);

    // Use tracking to help debug issues
    const trackingStream = createReadStream(filepath);
    await client.uploadFrom(trackingStream, filename);

    // Verify the upload
    const list = await client.list();
    const uploaded = list.find(f => f.name === filename);
    if (!uploaded) {
      throw new Error(`Fichier ${filename} non trouvé sur le serveur FTP après upload`);
    }
    if (uploaded.size < stat.size * 0.9) {
      throw new Error(`Fichier ${filename} incomplet sur FTP: ${uploaded.size} vs ${stat.size} octets`);
    }
  } finally {
    client.close();
  }
}

async function ftpDownload(config: CloudConfig, filename: string, destPath: string): Promise<void> {
  await withFtpClient(config, async (client) => {
    await client.downloadTo(destPath, filename);
  });
}

async function ftpDelete(config: CloudConfig, filename: string): Promise<void> {
  await withFtpClient(config, async (client) => {
    await client.remove(filename);
  });
}

async function ftpList(config: CloudConfig): Promise<{ name: string; size: number; lastModified: Date }[]> {
  return withFtpClient(config, async (client) => {
    const list = await client.list();
    return list
      .filter((f) => (f.name.endsWith(".sql.gz") || f.name.endsWith(".tar.gz")) && f.name.startsWith("backup_"))
      .map((f) => ({
        name: f.name,
        size: f.size,
        lastModified: f.modifiedAt || new Date(),
      }));
  });
}

async function ftpTestConnection(config: CloudConfig): Promise<{ success: boolean; error?: string }> {
  try {
    await withFtpClient(config, async () => {});
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── SFTP ─────────────────────────────────────────────

function sftpConnectConfig(config: CloudConfig): Parameters<SftpClient["connect"]>[0] {
  return {
    host: config.ftpHost,
    port: config.ftpPort || 22,
    username: config.ftpUser,
    password: config.ftpPassword,
    readyTimeout: 15000,
    retries: 1,
  };
}

async function withSftpClient<T>(config: CloudConfig, fn: (client: SftpClient, remotePath: string) => Promise<T>): Promise<T> {
  const client = new SftpClient();
  try {
    await client.connect(sftpConnectConfig(config));
    const remotePath = config.ftpPath || "/backups";
    const exists = await client.exists(remotePath);
    if (!exists) {
      await client.mkdir(remotePath, true);
    }
    return await fn(client, remotePath);
  } finally {
    await client.end();
  }
}

async function sftpUpload(config: CloudConfig, filepath: string, filename: string): Promise<void> {
  const stat = await fs.stat(filepath);
  if (stat.size === 0) throw new Error("Le fichier backup est vide, upload SFTP annulé");

  await withSftpClient(config, async (client, remotePath) => {
    const remoteDest = path.posix.join(remotePath, filename);
    await client.fastPut(filepath, remoteDest);
    const info = await client.stat(remoteDest);
    if (info.size < stat.size * 0.9) {
      throw new Error(`Fichier ${filename} incomplet sur SFTP: ${info.size} vs ${stat.size} octets`);
    }
  });
}

async function sftpDownload(config: CloudConfig, filename: string, destPath: string): Promise<void> {
  await withSftpClient(config, async (client, remotePath) => {
    const remoteFile = path.posix.join(remotePath, filename);
    await client.fastGet(remoteFile, destPath);
  });
}

async function sftpDelete(config: CloudConfig, filename: string): Promise<void> {
  await withSftpClient(config, async (client, remotePath) => {
    const remoteFile = path.posix.join(remotePath, filename);
    await client.delete(remoteFile);
  });
}

async function sftpList(config: CloudConfig): Promise<{ name: string; size: number; lastModified: Date }[]> {
  return withSftpClient(config, async (client, remotePath) => {
    const list = await client.list(remotePath);
    return list
      .filter((f) => (f.name.endsWith(".sql.gz") || f.name.endsWith(".tar.gz")) && f.name.startsWith("backup_"))
      .map((f) => ({
        name: f.name,
        size: f.size,
        lastModified: new Date(f.modifyTime),
      }));
  });
}

async function sftpTestConnection(config: CloudConfig): Promise<{ success: boolean; error?: string }> {
  try {
    await withSftpClient(config, async (_client, _remotePath) => {});
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Encryption ──────────────────────────────────────

const ENC_MAGIC = Buffer.from("COMET_ENC");

function getEncryptionKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length < 64) return null;
  return Buffer.from(hex, "hex");
}

async function encryptFile(inputPath: string, outputPath: string): Promise<void> {
  const key = getEncryptionKey();
  if (!key) throw new Error("ENCRYPTION_KEY requise pour chiffrer les backups cloud");

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const input = createReadStream(inputPath);
  const output = createWriteStream(outputPath);

  // Write header: magic (9 bytes) + iv (16 bytes)
  output.write(ENC_MAGIC);
  output.write(iv);

  await pipeline(input, cipher, output);

  // Append auth tag (16 bytes) at the end
  const authTag = cipher.getAuthTag();
  await fs.appendFile(outputPath, authTag);
}

async function decryptFile(inputPath: string, outputPath: string): Promise<void> {
  const key = getEncryptionKey();
  if (!key) throw new Error("ENCRYPTION_KEY requise pour déchiffrer les backups cloud");

  const data = await fs.readFile(inputPath);

  // Verify magic header
  if (!data.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC)) {
    // Not encrypted — copy as-is (backward compat with old unencrypted backups)
    await fs.copyFile(inputPath, outputPath);
    return;
  }

  const iv = data.subarray(ENC_MAGIC.length, ENC_MAGIC.length + 16);
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(ENC_MAGIC.length + 16, data.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  await fs.writeFile(outputPath, decrypted);
}

function isEncryptionAvailable(): boolean {
  return getEncryptionKey() !== null;
}

// ─── Public API ───────────────────────────────────────

export async function cloudUpload(filepath: string, filename: string): Promise<void> {
  const config = await getCloudConfig();
  if (config.provider === "none") return;

  // Encrypt before uploading if ENCRYPTION_KEY is available
  let uploadPath = filepath;
  const encrypted = isEncryptionAvailable();
  if (encrypted) {
    uploadPath = filepath + ".enc";
    await encryptFile(filepath, uploadPath);
    console.log(`[backup] Backup chiffré avant upload cloud: ${filename}`);
  }

  try {
    if (config.provider === "s3") {
      await s3Upload(config, uploadPath, filename);
    } else if (config.provider === "ftp") {
      await ftpUpload(config, uploadPath, filename);
    } else if (config.provider === "sftp") {
      await sftpUpload(config, uploadPath, filename);
    }
  } finally {
    if (encrypted && uploadPath !== filepath) {
      await fs.rm(uploadPath, { force: true }).catch(() => {});
    }
  }
}

export async function cloudDownload(filename: string, destPath: string): Promise<void> {
  const config = await getCloudConfig();

  // Download to a temp path first
  const tmpPath = destPath + ".dl";

  try {
    if (config.provider === "s3") {
      await s3Download(config, filename, tmpPath);
    } else if (config.provider === "ftp") {
      await ftpDownload(config, filename, tmpPath);
    } else if (config.provider === "sftp") {
      await sftpDownload(config, filename, tmpPath);
    } else {
      throw new Error("Aucun provider cloud configuré");
    }

    // Check if the downloaded file is encrypted and decrypt
    const header = Buffer.alloc(ENC_MAGIC.length);
    const fd = await fs.open(tmpPath, "r");
    try {
      await fd.read(header, 0, ENC_MAGIC.length, 0);
    } finally {
      await fd.close();
    }

    if (header.equals(ENC_MAGIC) && isEncryptionAvailable()) {
      await decryptFile(tmpPath, destPath);
      console.log(`[backup] Backup cloud déchiffré: ${filename}`);
    } else {
      await fs.rename(tmpPath, destPath);
    }
  } finally {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
  }
}

export async function cloudDelete(filename: string): Promise<void> {
  const config = await getCloudConfig();
  if (config.provider === "none") return;

  if (config.provider === "s3") {
    await s3Delete(config, filename);
  } else if (config.provider === "ftp") {
    await ftpDelete(config, filename);
  } else if (config.provider === "sftp") {
    await sftpDelete(config, filename);
  }
}

export async function cloudList(): Promise<{ name: string; size: number; lastModified: Date }[]> {
  const config = await getCloudConfig();
  if (config.provider === "s3") {
    return s3List(config);
  } else if (config.provider === "ftp") {
    return ftpList(config);
  } else if (config.provider === "sftp") {
    return sftpList(config);
  }
  return [];
}

export async function cloudTestConnection(config?: CloudConfig): Promise<{ success: boolean; error?: string }> {
  const cfg = config || await getCloudConfig();
  if (cfg.provider === "s3") {
    return s3TestConnection(cfg);
  } else if (cfg.provider === "ftp") {
    return ftpTestConnection(cfg);
  } else if (cfg.provider === "sftp") {
    return sftpTestConnection(cfg);
  }
  return { success: false, error: "Aucun provider configuré" };
}
