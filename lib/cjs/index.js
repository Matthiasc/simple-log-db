"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleLogDB = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_2 = require("node:fs");
const read_last_lines_1 = __importDefault(require("read-last-lines"));
function SimpleLogDB(filePath, options = {}) {
    const { maxFileSize = 5 * 1024 * 1024, // Default to 5MB
    rotationEnabled = true, maxFileCount = 5, addTimestamp = true, } = options;
    const dir = node_path_1.default.dirname(filePath);
    const baseName = node_path_1.default.basename(filePath, node_path_1.default.extname(filePath));
    const ext = node_path_1.default.extname(filePath);
    // Ensure the directory exists
    node_fs_1.promises.mkdir(dir, { recursive: true }).catch(() => { });
    // Initialize the log file
    node_fs_1.promises.access(filePath).catch(() => {
        node_fs_1.promises.writeFile(filePath, '');
    });
    // Get all rotated log files sorted by creation time (oldest first)
    function getRotatedLogFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const files = yield node_fs_1.promises.readdir(dir);
                const rotatedFiles = files.filter(file => file.startsWith(baseName + '-') && file.endsWith(ext) && file !== node_path_1.default.basename(filePath)).map(file => node_path_1.default.join(dir, file));
                // Sort by creation time (oldest first)
                const filesWithStats = yield Promise.all(rotatedFiles.map((file) => __awaiter(this, void 0, void 0, function* () {
                    return ({
                        file,
                        birthtime: (yield node_fs_1.promises.stat(file)).birthtimeMs
                    });
                })));
                return filesWithStats
                    .sort((a, b) => a.birthtime - b.birthtime)
                    .map(item => item.file);
            }
            catch (err) {
                console.error('Error getting rotated log files:', err);
                return [];
            }
        });
    }
    // Clean up old log files if we exceed maxFileCount
    function cleanupOldLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            if (maxFileCount <= 0)
                return;
            try {
                const rotatedFiles = yield getRotatedLogFiles();
                if (rotatedFiles.length >= maxFileCount) {
                    const filesToDelete = rotatedFiles.slice(0, rotatedFiles.length - maxFileCount + 1);
                    yield Promise.all(filesToDelete.map(file => node_fs_1.promises.unlink(file)));
                }
            }
            catch (err) {
                console.error('Error cleaning up old log files:', err);
            }
        });
    }
    // Rotate the log file if it exceeds the max size
    function rotateLogFile() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { size } = (0, node_fs_2.statSync)(filePath);
                if (size >= maxFileSize) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const newFileName = `${baseName}-${timestamp}${ext}`;
                    const newFilePath = node_path_1.default.join(dir, newFileName);
                    yield node_fs_1.promises.rename(filePath, newFilePath);
                    yield node_fs_1.promises.writeFile(filePath, '');
                    // Clean up old logs after rotation
                    yield cleanupOldLogs();
                }
            }
            catch (err) {
                console.error('Error during log rotation:', err);
            }
        });
    }
    function addEntry(entry) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let entries = Array.isArray(entry) ? entry : [entry];
                if (addTimestamp) {
                    entries = entries.map(e => (Object.assign({ timestamp: new Date().toISOString() }, e)));
                }
                const strLines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
                yield node_fs_1.promises.appendFile(filePath, strLines, 'utf8');
                if (rotationEnabled)
                    yield rotateLogFile();
            }
            catch (err) {
                console.error('Error adding entry:', err);
            }
        });
    }
    function last(n = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const lines = yield read_last_lines_1.default.read(filePath, n, 'utf8');
                return lines
                    .trim()
                    .split('\n')
                    .map(line => {
                    try {
                        return JSON.parse(line);
                    }
                    catch (_a) {
                        return null;
                    }
                })
                    .filter((entry) => entry !== null);
            }
            catch (err) {
                console.error('Error reading last lines:', err);
                return [];
            }
        });
    }
    function readRaw() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield node_fs_1.promises.readFile(filePath, 'utf8');
        });
    }
    function clear() {
        return __awaiter(this, void 0, void 0, function* () {
            yield node_fs_1.promises.writeFile(filePath, '', 'utf8');
        });
    }
    return {
        add: addEntry,
        last,
        clear,
        readRaw,
    };
}
exports.SimpleLogDB = SimpleLogDB;
