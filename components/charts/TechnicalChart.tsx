"use client";

import { memo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "#1F2937",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#e5e7eb",
};

const LABEL_STYLE = { color: "#f3f4f6", fontSize: 12 };
const TICK_STYLE = { fill: "#9ca3af", fontSize: 10 };
const GRID_COLOR = "rgba(75, 85, 99, 0.2)";
const AXIS_COLOR = "#9ca3af";

export interface TechDataset {
  key: string;
  label: string;
  color: string;
  type?: "line" | "bar";
  dashed?: boolean;
  /** Per-bar color based on value (used for MACD histogram) */
  barColorFn?: (value: number) => string;
}

export interface TechReferenceLine {
  y: number;
  color: string;
  label: string;
}

interface TechnicalChartProps {
  data: Array<Record<string, unknown>>;
  datasets: TechDataset[];
  title?: string;
  height?: number;
  yDomain?: [string | number, string | number];
  referenceLines?: TechReferenceLine[];
  yTickFormatter?: (value: number) => string;
  xDataKey?: string;
}

export const TechnicalChart = memo(function TechnicalChart({
  data,
  datasets,
  title,
  height = 320,
  yDomain = ["auto", "auto"],
  referenceLines = [],
  yTickFormatter,
  xDataKey = "date",
}: TechnicalChartProps) {
  return (
    <div>
      {title && (
        <h3 className="text-base font-semibold mb-3 text-foreground">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
          <XAxis
            dataKey={xDataKey}
            stroke={AXIS_COLOR}
            tick={{ ...TICK_STYLE }}
            angle={-45}
            textAnchor="end"
          />
          <YAxis
            stroke={AXIS_COLOR}
            tick={{ ...TICK_STYLE }}
            domain={yDomain}
            tickFormatter={yTickFormatter}
            width={60}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={LABEL_STYLE}
            itemStyle={{ color: "#e5e7eb" }}
          />
          <Legend wrapperStyle={{ color: "#e5e7eb", fontSize: 12, paddingTop: 8 }} />

          {referenceLines.map((rl, i) => (
            <ReferenceLine
              key={i}
              y={rl.y}
              stroke={rl.color}
              strokeDasharray="6 6"
              label={{
                value: rl.label,
                position: "insideTopRight",
                fill: "#9ca3af",
                fontSize: 9,
              }}
            />
          ))}

          {datasets.map((ds) => {
            if (ds.type === "bar") {
              return (
                <Bar
                  key={ds.key}
                  dataKey={ds.key}
                  name={ds.label}
                  fill={ds.color}
                  maxBarSize={8}
                >
                  {ds.barColorFn &&
                    data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={ds.barColorFn!(entry[ds.key] as number)}
                      />
                    ))}
                </Bar>
              );
            }
            return (
              <Line
                key={ds.key}
                type="monotone"
                dataKey={ds.key}
                name={ds.label}
                stroke={ds.color}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray={ds.dashed ? "5 5" : undefined}
                connectNulls
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});
