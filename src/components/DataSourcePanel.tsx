import { useState } from "react";
import { CSVData, SampleDataset } from "@/types/csv";
import { sampleDatasets } from "@/data/csvData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileUploader } from "./FileUploader";
import { LayoutDashboard, Database, Upload, Table2, Sparkles, MessageSquare } from "lucide-react";
import { Loader } from "./Loader";

interface DataSourcePanelProps {
  onDataLoaded: (data: CSVData, sourceName: string) => void;
  isLoading: boolean;
}

export function DataSourcePanel({ onDataLoaded, isLoading }: DataSourcePanelProps) {
  const [selectedSample, setSelectedSample] = useState<string>(sampleDatasets[0].id);
  const [loadingSample, setLoadingSample] = useState(false);

  const handleLoadSample = async () => {
    const dataset = sampleDatasets.find(d => d.id === selectedSample);
    if (dataset) {
      setLoadingSample(true);
      // Simulate loading delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      onDataLoaded(dataset.data, dataset.name);
      setLoadingSample(false);
    }
  };

  const handleFileLoaded = (content: string, fileName: string) => {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return;

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => parseCSVLine(line));

    const data: CSVData = {
      headers,
      rows,
      rawContent: content
    };

    onDataLoaded(data, fileName);
  };

  return (
    <div className="gradient-sidebar rounded-xl p-6 text-primary-foreground h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Table2 className="w-6 h-6" />
          <h1 className="font-display text-xl font-bold">Table GPT</h1>
        </div>
        <p className="text-primary-foreground/70 text-sm">CSV Data Assistant</p>
      </div>

      {/* Description */}
      <div className="mb-4 p-3 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 space-y-2">
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
          <p className="text-xs text-primary-foreground/90 leading-relaxed">
            Upload a file and have a conversation with your data — explore, ask, and discover.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
          <p className="text-xs text-primary-foreground/90 leading-relaxed">
            Get instant, easy-to-understand answers and helpful suggestions.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
          <p className="text-xs text-primary-foreground/90 leading-relaxed">
            See highlights, totals, and helpful tips instantly.
          </p>
        </div>
      </div>

      {/* Dashboard Button */}
      <Button
        variant="outline"
        className="w-full justify-start gap-2 mb-4 bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
        onClick={() => window.location.href = "/web/agentai/table_gpt_plus/dashboard"}
      >
        <LayoutDashboard className="h-4 w-4" />
        WMA TableGPT User Log
      </Button>

      {/* Tabs */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="sample" className="flex flex-col flex-1">
          <TabsList className="w-full bg-primary-foreground/10 p-1 rounded-lg">
            <TabsTrigger 
              value="sample" 
              className="flex-1 data-[state=active]:bg-primary-foreground data-[state=active]:text-primary text-primary-foreground/80 gap-2"
            >
              <Database className="w-4 h-4" />
              Sample Data
            </TabsTrigger>
            <TabsTrigger 
              value="upload" 
              className="flex-1 data-[state=active]:bg-primary-foreground data-[state=active]:text-primary text-primary-foreground/80 gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sample" className="flex-1 mt-4 space-y-4">
            <RadioGroup 
              value={selectedSample} 
              onValueChange={setSelectedSample}
              className="space-y-2"
            >
              {sampleDatasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all
                    ${selectedSample === dataset.id 
                      ? 'bg-primary-foreground/20 ring-1 ring-primary-foreground/30' 
                      : 'bg-primary-foreground/5 hover:bg-primary-foreground/10'
                    }
                  `}
                  onClick={() => setSelectedSample(dataset.id)}
                >
                  <RadioGroupItem 
                    value={dataset.id} 
                    id={dataset.id}
                    className="mt-0.5 border-primary-foreground/50 text-primary-foreground"
                  />
                  <Label 
                    htmlFor={dataset.id} 
                    className="flex-1 cursor-pointer"
                  >
                    <span className="font-medium text-primary-foreground block">
                      {dataset.name}
                    </span>
                    <span className="text-xs text-primary-foreground/60">
                      {dataset.description}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Button
              onClick={handleLoadSample}
              disabled={loadingSample || isLoading}
              variant="sidebar"
              className="w-full"
            >
              {loadingSample ? (
                <Loader size="sm" />
              ) : (
                "Load Data"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="flex-1 mt-4">
            <div className="bg-primary-foreground/10 rounded-lg p-4">
              <FileUploader 
                onFileLoaded={handleFileLoaded}
                isLoading={isLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
