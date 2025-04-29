import { promises as fs } from 'node:fs';
import path from 'node:path';
import { statSync } from 'node:fs';
import rll from 'read-last-lines';
export function SimpleLogDB(filePath, options = {}) {
    const { maxFileSize = 5 * 1024 * 1024, // Default to 5MB
    rotationEnabled = true, maxFileCount = 5, addTimestamp = true, } = options;
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
    async function getRotatedLogFiles() {
        try {
            const files = await fs.readdir(dir);
            const rotatedFiles = files.filter(file => file.startsWith(baseName + '-') && file.endsWith(ext) && file !== path.basename(filePath)).map(file => path.join(dir, file));
            // Sort by creation time (oldest first)
            const filesWithStats = await Promise.all(rotatedFiles.map(async (file) => ({
                file,
                birthtime: (await fs.stat(file)).birthtimeMs
            })));
            return filesWithStats
                .sort((a, b) => a.birthtime - b.birthtime)
                .map(item => item.file);
        }
        catch (err) {
            console.error('Error getting rotated log files:', err);
            return [];
        }
    }
    // Clean up old log files if we exceed maxFileCount
    async function cleanupOldLogs() {
        if (maxFileCount <= 0)
            return;
        try {
            const rotatedFiles = await getRotatedLogFiles();
            if (rotatedFiles.length >= maxFileCount) {
                const filesToDelete = rotatedFiles.slice(0, rotatedFiles.length - maxFileCount + 1);
                await Promise.all(filesToDelete.map(file => fs.unlink(file)));
            }
        }
        catch (err) {
            console.error('Error cleaning up old log files:', err);
        }
    }
    // Rotate the log file if it exceeds the max size
    async function rotateLogFile() {
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
        }
        catch (err) {
            console.error('Error during log rotation:', err);
        }
    }
    async function addEntry(entry) {
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
            if (rotationEnabled)
                await rotateLogFile();
        }
        catch (err) {
            console.error('Error adding entry:', err);
        }
    }
    async function last(n = 1) {
        try {
            const lines = await rll.read(filePath, n, 'utf8');
            return lines
                .trim()
                .split('\n')
                .map(line => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            })
                .filter((entry) => entry !== null);
        }
        catch (err) {
            console.error('Error reading last lines:', err);
            return [];
        }
    }
    async function readRaw() {
        return await fs.readFile(filePath, 'utf8');
    }
    async function clear() {
        await fs.writeFile(filePath, '', 'utf8');
    }
    return {
        add: addEntry,
        last,
        clear,
        readRaw,
    };
}
