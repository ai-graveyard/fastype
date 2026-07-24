/**
 * File System Access API 的最小声明。
 * TypeScript 内置 lib 目前只有 FileSystemFileHandle 的读取部分，写回相关的接口还没进标准 lib。
 */
interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(options?: {
    keepExistingData?: boolean;
  }): Promise<FileSystemWritableFileStream>;
}
