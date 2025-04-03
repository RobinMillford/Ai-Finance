// lib/useChartConfig.ts
'use client'; // Mark as client-side

import { useEffect } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

export function useChartConfig() {
  useEffect(() => {
    Chart.register(
      BarController,
      BarElement,
      CategoryScale,
      LinearScale,
      Tooltip,
      Legend
    );
    console.log('Chart.js registered client-side');
  }, []);
}