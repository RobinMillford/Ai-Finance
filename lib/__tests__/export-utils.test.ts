import * as ExportUtils from '../export-utils';

// Mock DOM methods used in export-utils

// Mock jsPDF and autoTable at module level before imports that use them
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
    internal: { getNumberOfPages: () => 1, pageSize: { getWidth: () => 100, getHeight: () => 100 } },
    setPage: jest.fn(),
  }));
});

jest.mock('jspdf-autotable', () => jest.fn());

beforeEach(() => {
  // Mock URL.createObjectURL
  // @ts-ignore
  global.URL.createObjectURL = jest.fn(() => 'blob:url');

  // Mock document.createElement and body append/remove
  const realCreate = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
    if (tagName === 'a') {
      const el = realCreate(tagName);
      el.click = jest.fn();
      return el;
    }
    return realCreate(tagName);
  });
});

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

test('exportPortfolioToCSV creates and clicks link', () => {
  const portfolio = { _id: '1', name: 'My Port', description: '', holdings: [] } as any;
  const holdings = [
    { symbol: 'ABC', purchasePrice: 10, purchaseDate: '2023-01-01', quantity: 2, currentPrice: 12 }
  ];

  const res = ExportUtils.exportPortfolioToCSV(portfolio, holdings as any);
  expect(res).toBe(true);
  // Ensure createObjectURL was called
  // @ts-ignore
  expect(global.URL.createObjectURL).toHaveBeenCalled();
});

test('exportPortfolioToPDF calls jsPDF save', () => {
  // Re-import after mocking
  jest.resetModules();
  const jsPDF = require('jspdf');
  const autoTable = require('jspdf-autotable');
  const utils = require('../export-utils');

  const portfolio = { _id: '1', name: 'My Port', description: 'd', holdings: [] } as any;
  const holdings = [
    { symbol: 'ABC', purchasePrice: 10, purchaseDate: '2023-01-01', quantity: 2, currentPrice: 12 }
  ];

  const res = utils.exportPortfolioToPDF(portfolio, holdings as any);
  expect(res).toBe(true);
  const Doc = jsPDF.mock.results[0].value;
  expect(Doc.save).toHaveBeenCalled();
});
