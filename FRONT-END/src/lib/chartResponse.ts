import { ChatMessage } from "@/types/csv";

const CHART_TERMS = [
  "chart",
  "graph",
  "plot",
  "visual",
  "visualize",
  "visualise",
  "bar",
  "line",
  "pie",
  "donut",
  "scatter",
  "histogram",
  "trend",
];

const METRIC_TERMS = [
  "amount",
  "sales",
  "sale",
  "qty",
  "quantity",
  "count",
  "total",
  "sum",
  "value",
  "revenue",
  "debit",
  "credit",
  "rate",
  "percent",
  "percentage",
];

export const groundChartAnswer = (
  userQuery: string,
  answer: string,
  visualizationSpec: unknown,
  resultTable?: ChatMessage["result_table"],
  resultTables?: ChatMessage["result_tables"],
) => {
  if (!isChartRequest(userQuery)) {
    return answer;
  }

  const rowCount = getRowCount(resultTable, resultTables);
  if (visualizationSpec || buildFallbackChartSpec(userQuery, resultTable, resultTables)) {
    return rowCount
      ? `I found ${rowCount} data point(s) and generated the requested chart.`
      : "I generated the requested chart.";
  }

  if (rowCount > 0) {
    return `I found ${rowCount} row(s), but I could not build a chart from the returned columns. I have shown the result table instead.`;
  }

  if (claimsChartWasPrepared(answer)) {
    return "I could not build the requested chart because no chart data was returned.";
  }

  return answer;
};

export const buildFallbackChartSpec = (
  userQuery: string,
  resultTable?: ChatMessage["result_table"],
  resultTables?: ChatMessage["result_tables"],
) => {
  if (!isChartRequest(userQuery)) {
    return null;
  }

  const table = resultTable || resultTables?.find((candidate) => candidate.rows?.length);
  if (!table?.headers?.length || !table.rows?.length) {
    return null;
  }

  const numericColumnIndex = table.headers.findIndex((header, index) =>
    table.rows.some((row) => toNumber(row[index]) !== null),
  );
  const metricColumnIndex = table.headers.findIndex((header, index) =>
    index > 0 && isMetricHeader(header),
  );
  const valueColumnIndex = numericColumnIndex >= 0 ? numericColumnIndex : metricColumnIndex;
  if (valueColumnIndex < 0) {
    return null;
  }

  const labelColumnIndex =
    table.headers.findIndex((_, index) => index !== valueColumnIndex) >= 0
      ? table.headers.findIndex((_, index) => index !== valueColumnIndex)
      : valueColumnIndex;
  const rows = table.rows.slice(0, 50);
  const x = rows.map((row, index) => row[labelColumnIndex] || `${index + 1}`);
  const y = rows.map((row) => toNumber(row[valueColumnIndex]) ?? 0);
  const query = (userQuery || "").toLowerCase();
  const traceType = query.includes("pie")
    ? "pie"
    : query.includes("line") || query.includes("trend") || query.includes("weekly")
      ? "scatter"
      : "bar";

  if (traceType === "pie") {
    return {
      data: [
        {
          type: "pie",
          labels: x,
          values: y,
          name: table.headers[valueColumnIndex],
        },
      ],
      layout: fallbackLayout(userQuery),
    };
  }

  return {
    data: [
      {
        type: traceType,
        mode: traceType === "scatter" ? "lines+markers" : undefined,
        x,
        y,
        name: table.headers[valueColumnIndex],
      },
    ],
    layout: {
      ...fallbackLayout(userQuery),
      xaxis: { title: table.headers[labelColumnIndex] },
      yaxis: { title: table.headers[valueColumnIndex] },
    },
  };
};

export const buildFallbackChartFromMessages = (
  userQuery: string,
  messages: ChatMessage[],
) => {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") continue;
    const chart = buildFallbackChartSpec(
      userQuery,
      message.result_table,
      message.result_tables,
    );
    if (chart) return chart;
  }
  return null;
};

const isChartRequest = (query: string) => {
  const normalized = (query || "").toLowerCase();
  return CHART_TERMS.some((term) => normalized.includes(term));
};

const getRowCount = (
  resultTable?: ChatMessage["result_table"],
  resultTables?: ChatMessage["result_tables"],
) => {
  if (resultTables?.length) {
    return resultTables.reduce((total, table) => total + (table.rows?.length || 0), 0);
  }
  return resultTable?.rows?.length || 0;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const isMetricHeader = (header: string) => {
  const normalized = (header || "").toLowerCase();
  return METRIC_TERMS.some((term) => normalized.includes(term));
};

const fallbackLayout = (userQuery: string) => ({
  title: { text: (userQuery || "Chart").trim() },
  height: 480,
  template: "plotly_white",
  hovermode: "closest",
});

const claimsChartWasPrepared = (answer: string) => {
  const normalized = (answer || "").toLowerCase();
  return (
    normalized.includes("prepared a chart") ||
    normalized.includes("generated a chart") ||
    normalized.includes("here is the chart") ||
    normalized.includes("showing the") && normalized.includes("chart")
  );
};
