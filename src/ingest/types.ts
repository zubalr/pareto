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

export interface HarborRow {
  id: string;
  leaderboard_id: string;
  rank?: number;
  metadata?: {
    date?: string;
    agent_org?: { url?: string; label?: string };
    model_org?: { url?: string; label?: string };
    display_date?: string;
    agent_display?: { url?: string; label?: string };
    model_display?: { url?: string; label?: string };
    reasoning_effort?: string;
  };
  metrics?: {
    accuracy?: number;
    n_trials?: number;
    pass_at_2?: number;
    pass_at_3?: number;
    pass_at_4?: number;
    pass_at_5?: number;
    successes?: number;
    display_cost?: string;
    total_tokens?: number;
    output_tokens?: number;
    total_cost_usd?: number;
    display_accuracy?: string;
    cached_input_tokens?: number;
    uncached_input_tokens?: number;
    avg_trial_duration_sec?: number;
    accuracy_ci95_half_width?: number;
  };
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SWEBenchResultItem {
  name: string;
  folder: string;
  resolved: number;
  date?: string;
  tags?: string[];
  reasoning_effort?: string | null;
  site?: string;
  trajs?: string;
  oss?: boolean;
  verified?: boolean;
}

export interface SWEBenchLeaderboard {
  name: string;
  results?: SWEBenchResultItem[];
}

export interface SWEBenchLeaderboardResponse {
  leaderboards?: SWEBenchLeaderboard[];
}

export interface DeepSWERow {
  model: string;
  harness: string;
  provider?: string;
  reasoning_effort?: string;
  config: string;
  source?: string;
  cost_basis?: string;
  pass_rate?: number;
  pass_at_1?: number;
  pass_at_4?: number;
  n_passed?: number;
  n_attempted?: number;
  n_tasks_attempted?: number;
  n_tasks_passed_any?: number;
  ci_passed?: number;
  ci_attempted?: number;
  ci_lo?: number;
  ci_hi?: number;
  ci_half?: number;
  n_runs?: number;
  ci_method?: string;
  mean_cost_usd?: number;
  median_cost_usd?: number;
  mean_output_tokens?: number;
  median_output_tokens?: number;
  mean_input_tokens?: number;
  median_input_tokens?: number;
  mean_duration_seconds?: number;
  median_duration_seconds?: number;
}

export interface DeepSWELeaderboardResponse {
  generated_at?: string;
  n_tasks_in_set?: number;
  scope?: string;
  unit?: string;
  rows?: DeepSWERow[];
}

export interface IngestPipelineResult {
  jobId: string;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  aiderRunsCount: number;
  openRouterSnapshotsCount: number;
  harborRunsCount: number;
  swebenchRunsCount: number;
  deepsweRunsCount?: number;
  restatedRunsCount?: number;
  warmedCacheKeys: string[];
  error?: string;
}

