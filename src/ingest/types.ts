export interface AiderPolyglotYamlItem {
  dirname: string;
  test_cases?: number;
  model: string;
  edit_format?: string;
  commit_hash?: string;
  pass_rate_1?: number;
  pass_rate_2?: number;
  pass_num_1?: number;
  pass_num_2?: number;
  percent_cases_well_formed?: number;
  error_outputs?: number;
  num_malformed_responses?: number;
  num_with_malformed_responses?: number;
  user_asks?: number;
  lazy_comments?: number;
  syntax_errors?: number;
  indentation_errors?: number;
  exhausted_context_windows?: number;
  test_timeouts?: number;
  total_tests?: number;
  command?: string;
  date?: string;
  versions?: string;
  seconds_per_case?: number;
  total_cost?: number | string;
  reasoning_effort?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  thinking_tokens?: number;
  editor_model?: string;
  editor_edit_format?: string;
}

export interface OpenRouterPricing {
  prompt?: string;
  completion?: string;
  request?: string;
  image?: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

export interface OpenRouterModelItem {
  id: string;
  canonical_slug?: string;
  name?: string;
  created?: number;
  description?: string;
  context_length?: number;
  pricing?: OpenRouterPricing;
}

export interface OpenRouterApiResponse {
  data: OpenRouterModelItem[];
}

export interface IngestPipelineResult {
  jobId: string;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  aiderRunsCount: number;
  openRouterSnapshotsCount: number;
  warmedCacheKeys: string[];
  error?: string;
}
