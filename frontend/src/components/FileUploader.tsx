import { useCallback, useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Loader } from "./Loader";

interface FileUploaderProps {
  onFileLoaded: (content: string, fileName: string) => void;
  isLoading: boolean;
}

export function FileUploader({ onFileLoaded, isLoading }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      setError("Please upload a CSV, XLS, or XLSX file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setUploadedFile(file.name);
      onFileLoaded(content, file.name);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader text="Processing file..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5" 
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          error && "border-destructive bg-destructive/5"
        )}
      >
        <input
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center gap-3">
          {uploadedFile ? (
            <>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">{uploadedFile}</p>
                <p className="text-sm text-muted-foreground">File loaded successfully</p>
              </div>
            </>
          ) : error ? (
            <>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground">Try again with a valid file</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  Drop your file here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse (CSV, XLS, XLSX - max 10MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadedFile && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm text-foreground flex-1 truncate">{uploadedFile}</span>
          <button
            onClick={() => {
              setUploadedFile(null);
              setError(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Change
          </button>
        </div>
      )}
    </div>
  );
}
