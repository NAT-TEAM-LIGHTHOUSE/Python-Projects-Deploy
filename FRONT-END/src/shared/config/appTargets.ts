export type AppKey = "" | "sql_gpt" | "table_gpt_plus";

export type AppTarget = {
  key: AppKey;
  label: string;
  routePrefix: string;
  apiBase: string;
  botsPath: string;
  apiPrefix: string;
  iconSrc: string;
  botSelectLabel: string;
  botSelectPlaceholder: string;
  botSelectAriaLabel: string;
  clearLabel: string;
};

type AppTargetShape = Omit<AppTarget, "key">;
type AppTargetDefinition = AppTargetShape & { key: AppKey };

const sqlApiBase = import.meta.env.VITE_SQL_GPT_API_BASE || import.meta.env.VITE_API_BASE || "";
const tableApiBase =
  import.meta.env.VITE_TABLE_GPT_PLUS_API_BASE ||
  import.meta.env.VITE_API_BASE ||
  "";

export const APP_TARGETS = {
  sql_gpt: {
    key: "sql_gpt",
    label: "SQL GPT",
    routePrefix: "/web/agentai/process_gpt",
    apiBase: sqlApiBase,
    botsPath: "/api/bots",
    apiPrefix: "/api/agentai/sql_gpt",
    iconSrc: "/web/agentai/sql_gpt/assests/icon/artificial-intelligence.svg",
    botSelectLabel: "Select Bot",
    botSelectPlaceholder: "Select Bot",
    botSelectAriaLabel: "Select Bot",
    clearLabel: "Clear Chat",
  },
  table_gpt_plus: {
    key: "table_gpt_plus",
    label: "Table GPT Plus",
    routePrefix: "/web/agentai/process_gpt",
    apiBase: tableApiBase,
    botsPath: "/api/agentai/table_gpt_plus/chatbot/embed/bots",
    apiPrefix: "/api/agentai/table_gpt_plus",
    iconSrc: "/web/agentai/table_gpt_plus/assests/icon/artificial-intelligence.svg",
    botSelectLabel: "Select Bot",
    botSelectPlaceholder: "Select Process Model",
    botSelectAriaLabel: "Select Process Model",
    clearLabel: "Clear Chat",
  },
} as const satisfies Record<Exclude<AppKey, "">, AppTargetDefinition>;

const PLACEHOLDER_APP_TARGET: AppTarget = {
  key: "",
  label: "",
  routePrefix: "",
  apiBase: "",
  botsPath: "",
  apiPrefix: "",
  iconSrc: "",
  botSelectLabel: "",
  botSelectPlaceholder: "Select Process GPT",
  botSelectAriaLabel: "Select Process GPT",
  clearLabel: "Clear Chat",
};

export const DEFAULT_APP_KEY: AppKey = "";

export const getAppTarget = (key: AppKey): AppTarget => {
  if (key === "sql_gpt") return APP_TARGETS.sql_gpt;
  if (key === "table_gpt_plus") return APP_TARGETS.table_gpt_plus;
  return PLACEHOLDER_APP_TARGET;
};
