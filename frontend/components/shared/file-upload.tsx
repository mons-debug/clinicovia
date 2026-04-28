"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, X, FileText, Image } from "lucide-react";

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  label?: string;
  description?: string;
}

export function FileUpload({
  accept,
  maxSizeMB = 10,
  multiple = false,
  onFilesSelected,
  label = "Upload files",
  description,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const valid = Array.from(files).filter(
        (f) => f.size <= maxSizeMB * 1024 * 1024
      );
      const next = multiple ? [...selectedFiles, ...valid] : valid.slice(0, 1);
      setSelectedFiles(next);
      onFilesSelected(next);
    },
    [maxSizeMB, multiple, selectedFiles, onFilesSelected]
  );

  const removeFile = (index: number) => {
    const next = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(next);
    onFilesSelected(next);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary-light bg-primary-lighter/30"
            : "border-border bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          <Upload className="h-5 w-5 text-text-muted" />
        </div>
        <p className="mt-3 text-sm font-medium text-text-primary">{label}</p>
        <p className="mt-1 text-xs text-text-muted">
          {description || `Drag and drop or click to browse. Max ${maxSizeMB}MB.`}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File list */}
      {selectedFiles.length > 0 && (
        <ul className="space-y-2">
          {selectedFiles.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2"
            >
              {isImage(file.name) ? (
                <Image className="h-4 w-4 shrink-0 text-blue-500" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
                <p className="text-xs text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-gray-100 hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
