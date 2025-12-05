"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps {
  onExportCSV: () => Promise<boolean> | boolean;
  onExportPDF: () => Promise<boolean> | boolean;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({
  onExportCSV,
  onExportPDF,
  label = "Export",
  variant = "outline",
  size = "default",
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (type: "csv" | "pdf", exportFn: () => Promise<boolean> | boolean) => {
    setIsExporting(true);
    try {
      const success = await exportFn();
      
      if (success) {
        toast({
          title: "Export successful",
          description: `Your data has been exported as ${type.toUpperCase()}`,
        });
      } else {
        throw new Error("Export failed");
      }
    } catch (error) {
      console.error(`Error exporting ${type}:`, error);
      toast({
        title: "Export failed",
        description: `Failed to export as ${type.toUpperCase()}. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isExporting}>
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {label}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport("csv", onExportCSV)}
          disabled={isExporting}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
          <span>Export as CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("pdf", onExportPDF)}
          disabled={isExporting}
        >
          <FileText className="mr-2 h-4 w-4 text-red-600" />
          <span>Export as PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
