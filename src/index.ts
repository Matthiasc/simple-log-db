import { promises as fs } from 'node:fs';
import path from 'node:path';
import { statSync } from 'node:fs';
import rll from 'read-last-lines';

interface LogDBOptions {
  maxFileSize?: number; // Maximum file size in bytes before rotation
  maxFileCount?: number; // Maximum number of rotated files to keep
  rotationEnabled?: boolean; // Enable or disable log rotation
  addTimestamp?: boolean; // Add timestamp to each entry
}

export interface LogDB<T> {
  add: (entry: T | T[]) => Promise<void>;
  last: (n?: number) => Promise<(T & { timestamp: string })[]>;
  readRaw: () => Promise<string>;
  clear: () => Promise<void>;
}

export function SimpleLogDB<T extends object>(
  filePath: string,
  options: LogDBOptions = {}
): LogDB<T> {
  const {
    maxFileSize = 5 * 1024 * 1024, // Default to 5MB
    rotationEnabled = true,
    maxFileCount = 5,
    addTimestamp = true,
  } = options;

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const ext = path.extname(filePath);

  // Ensure the directory exists
  fs.mkdir(dir, { recursive: true }).catch(() => { });

  // Initialize the log file
  fs.access(filePath).catch(() => {
    fs.writeFile(filePath, '');
  });

  // Get all rotated log files sorted by creation time (oldest first)
  async function getRotatedLogFiles(): Promise<string[]> {

    try {
      const files = await fs.readdir(dir);
      const rotatedFiles = files.filter(file =>
        file.startsWith(baseName + '-') && file.endsWith(ext) && file !== path.basename(filePath)
      ).map(file => path.join(dir, file));


      // Sort by creation time (oldest first)
      const filesWithStats = await Promise.all(
        rotatedFiles.map(async file => ({
          file,
          birthtime: (await fs.stat(file)).birthtimeMs
        }))
      );



      return filesWithStats
        .sort((a, b) => a.birthtime - b.birthtime)
        .map(item => item.file);
    } catch (err) {
      console.error('Error getting rotated log files:', err);
      return [];
    }
  }

  // Clean up old log files if we exceed maxFileCount
  async function cleanupOldLogs(): Promise<void> {

    if (maxFileCount <= 0) return;

    try {

      const rotatedFiles = await getRotatedLogFiles();

      if (rotatedFiles.length >= maxFileCount) {
        const filesToDelete = rotatedFiles.slice(0, rotatedFiles.length - maxFileCount + 1);
        await Promise.all(filesToDelete.map(file => fs.unlink(file)));
      }
    } catch (err) {
      console.error('Error cleaning up old log files:', err);
    }
  }

  // Rotate the log file if it exceeds the max size
  async function rotateLogFile(): Promise<void> {
    try {
      const { size } = statSync(filePath);
      if (size >= maxFileSize) {

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newFileName = `${baseName}-${timestamp}${ext}`;
        const newFilePath = path.join(dir, newFileName);


        await fs.rename(filePath, newFilePath);
        await fs.writeFile(filePath, '');


        // Clean up old logs after rotation
        await cleanupOldLogs();
      }
    } catch (err) {
      console.error('Error during log rotation:', err);
    }
  }

  async function addEntry(entry: T | T[]): Promise<void> {
    try {
      let entries = Array.isArray(entry) ? entry : [entry];
      if (addTimestamp) {
        entries = entries.map(e => ({
          timestamp: new Date().toISOString(),
          ...e,
        }));
      }
      const strLines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.appendFile(filePath, strLines, 'utf8');
      if (rotationEnabled) await rotateLogFile();
    } catch (err) {
      console.error('Error adding entry:', err);
    }
  }

  async function last(n: number = 1): Promise<(T & { timestamp: string })[]> {
    try {
      const lines = await rll.read(filePath, n, 'utf8');
      return lines
        .trim()
        .split('\n')
        .map(line => {
          try {
            return JSON.parse(line) as T & { timestamp: string };
          } catch {
            return null;
          }
        })
        .filter((entry): entry is T & { timestamp: string } => entry !== null);
    } catch (err) {
      console.error('Error reading last lines:', err);
      return [];
    }
  }

  async function readRaw(): Promise<string> {
    return await fs.readFile(filePath, 'utf8');
  }

  async function clear(): Promise<void> {
    await fs.writeFile(filePath, '', 'utf8');
  }

  return {
    add: addEntry,
    last,
    clear,
    readRaw,
  };
}