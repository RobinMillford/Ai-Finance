"use client";

import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Types
interface Holding {
  symbol: string;
  name?: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice?: number;
}

interface Portfolio {
  _id: string;
  name: string;
  description?: string;
  holdings: Holding[];
}

interface WatchlistAsset {
  symbol: string;
  assetType: string;
  name?: string;
  addedAt: string;
  notes?: string;
  alertPrice?: number;
}

interface Watchlist {
  _id: string;
  name: string;
  assets: WatchlistAsset[];
}

// CSV Export Functions

export function exportPortfolioToCSV(portfolio: Portfolio, holdings: Holding[]) {
  try {
    const csvData = holdings.map((holding) => {
      const currentValue = (holding.currentPrice || holding.purchasePrice) * holding.quantity;
      const cost = holding.purchasePrice * holding.quantity;
      const pl = currentValue - cost;
      const plPercent = ((pl / cost) * 100).toFixed(2);

      return {
        Symbol: holding.symbol,
        Name: holding.name || holding.symbol,
        Quantity: holding.quantity,
        "Purchase Price": holding.purchasePrice.toFixed(2),
        "Purchase Date": new Date(holding.purchaseDate).toLocaleDateString(),
        "Current Price": (holding.currentPrice || holding.purchasePrice).toFixed(2),
        "Current Value": currentValue.toFixed(2),
        "P&L": pl.toFixed(2),
        "P&L %": plPercent + "%",
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `${portfolio.name.replace(/\s+/g, "_")}_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error("Error exporting portfolio to CSV:", error);
    return false;
  }
}

export function exportWatchlistToCSV(watchlist: Watchlist) {
  try {
    const csvData = watchlist.assets.map((asset) => ({
      Symbol: asset.symbol,
      Type: asset.assetType,
      Name: asset.name || asset.symbol,
      "Added Date": new Date(asset.addedAt).toLocaleDateString(),
      Notes: asset.notes || "",
      "Alert Price": asset.alertPrice || "",
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `${watchlist.name.replace(/\s+/g, "_")}_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error("Error exporting watchlist to CSV:", error);
    return false;
  }
}

// PDF Export Functions

export function exportPortfolioToPDF(portfolio: Portfolio, holdings: Holding[]) {
  try {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246); // Blue color
    doc.text("Portfolio Report", 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Portfolio: ${portfolio.name}`, 14, 30);
    
    if (portfolio.description) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(portfolio.description, 14, 36);
    }

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42);

    // Calculate totals
    let totalValue = 0;
    let totalCost = 0;

    const tableData = holdings.map((holding) => {
      const currentValue = (holding.currentPrice || holding.purchasePrice) * holding.quantity;
      const cost = holding.purchasePrice * holding.quantity;
      const pl = currentValue - cost;
      const plPercent = ((pl / cost) * 100).toFixed(2);

      totalValue += currentValue;
      totalCost += cost;

      return [
        holding.symbol,
        holding.quantity.toString(),
        `$${holding.purchasePrice.toFixed(2)}`,
        `$${currentValue.toFixed(2)}`,
        `$${pl.toFixed(2)}`,
        `${plPercent}%`,
      ];
    });

    const totalPL = totalValue - totalCost;
    const totalPLPercent = ((totalPL / totalCost) * 100).toFixed(2);

    // Summary section
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Summary", 14, 52);

    doc.setFontSize(10);
    doc.text(`Total Value: $${totalValue.toFixed(2)}`, 14, 60);
    doc.text(`Total Cost: $${totalCost.toFixed(2)}`, 14, 66);
    doc.setTextColor(totalPL >= 0 ? 34 : 220, totalPL >= 0 ? 197 : 38, totalPL >= 0 ? 94 : 38);
    doc.text(`Total P&L: $${totalPL.toFixed(2)} (${totalPLPercent}%)`, 14, 72);

    // Holdings table
    autoTable(doc, {
      startY: 80,
      head: [["Symbol", "Quantity", "Purchase Price", "Current Value", "P&L", "P&L %"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 9 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Generated by FinanceAI - Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Save
    const timestamp = new Date().toISOString().split("T")[0];
    doc.save(`${portfolio.name.replace(/\s+/g, "_")}_${timestamp}.pdf`);

    return true;
  } catch (error) {
    console.error("Error exporting portfolio to PDF:", error);
    return false;
  }
}

export function exportWatchlistToPDF(watchlist: Watchlist) {
  try {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(234, 179, 8); // Yellow color
    doc.text("Watchlist Report", 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Watchlist: ${watchlist.name}`, 14, 30);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    // Statistics
    const typeCount: { [key: string]: number } = {};
    watchlist.assets.forEach((asset) => {
      typeCount[asset.assetType] = (typeCount[asset.assetType] || 0) + 1;
    });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Statistics", 14, 46);

    doc.setFontSize(10);
    doc.text(`Total Assets: ${watchlist.assets.length}`, 14, 54);
    
    let yPos = 60;
    Object.entries(typeCount).forEach(([type, count]) => {
      doc.text(`${type}: ${count}`, 14, yPos);
      yPos += 6;
    });

    // Assets table
    const tableData = watchlist.assets.map((asset) => [
      asset.symbol,
      asset.assetType,
      asset.name || asset.symbol,
      new Date(asset.addedAt).toLocaleDateString(),
      asset.notes || "-",
      asset.alertPrice ? `$${asset.alertPrice}` : "-",
    ]);

    autoTable(doc, {
      startY: yPos + 10,
      head: [["Symbol", "Type", "Name", "Added Date", "Notes", "Alert Price"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [234, 179, 8] },
      styles: { fontSize: 9 },
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(
        `Generated by FinanceAI - Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Save
    const timestamp = new Date().toISOString().split("T")[0];
    doc.save(`${watchlist.name.replace(/\s+/g, "_")}_${timestamp}.pdf`);

    return true;
  } catch (error) {
    console.error("Error exporting watchlist to PDF:", error);
    return false;
  }
}
