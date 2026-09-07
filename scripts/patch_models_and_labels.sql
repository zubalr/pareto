-- 1. Fix Harbor Benchmark Name to eliminate duplicate '2.0 2.0'
UPDATE benchmarks
SET name = 'Terminal-Bench'
WHERE id = '01J8BENCH000000000000HARBOR' OR slug = 'terminal-bench-2';

-- 2. Merge claude-fable-5 into fable-5
-- Re-point any model_aliases pointing to claude-fable-5
UPDATE model_aliases
SET model_id = '01J8MODEL0000000000000FABLE5'
WHERE model_id = '01J8MODEL6B57881ACLAUDEFAB';

-- Ensure canonical claude-fable-5 alias exists pointing to fable-5
INSERT OR REPLACE INTO model_aliases (id, model_id, alias) VALUES
('01J8ALIAS000000000CLAUDEFAB', '01J8MODEL0000000000000FABLE5', 'claude-fable-5');

-- Re-point any runs pointing to claude-fable-5
UPDATE benchmark_runs
SET model_id = '01J8MODEL0000000000000FABLE5'
WHERE model_id = '01J8MODEL6B57881ACLAUDEFAB';

-- Re-point any pricing snapshots pointing to claude-fable-5 if any
UPDATE pricing_snapshots
SET model_id = '01J8MODEL0000000000000FABLE5'
WHERE model_id = '01J8MODEL6B57881ACLAUDEFAB';

-- Delete the orphan duplicate model row
DELETE FROM models
WHERE id = '01J8MODEL6B57881ACLAUDEFAB';

-- 3. Add canonical aliases for key models
INSERT OR REPLACE INTO model_aliases (id, model_id, alias) VALUES
('01J8ALIAS0000000000FABLE51', '01J8MODEL44C31453FABLE5100', 'fable-5-1'),
('01J8ALIAS000000000OR_FABL51', '01J8MODEL44C31453FABLE5100', 'anthropic/claude-fable-5.1'),
('01J8ALIAS000000000GPT6ASTRA', '01J8MODEL394C72A5GPT6ASTRA', 'gpt-6-astra'),
('01J8ALIAS00000000OR_GPT6AST', '01J8MODEL394C72A5GPT6ASTRA', 'openai/gpt-6-astra'),
('01J8ALIAS0000000000000GPT55', '01J8MODEL3D26B2FAGPT550000', 'gpt-5-5'),
('01J8ALIAS0000000000OR_GPT55', '01J8MODEL3D26B2FAGPT550000', 'openai/gpt-5.5'),
('01J8ALIAS0000000000000GPT54', '01J8MODEL3D26B2F9GPT540000', 'gpt-5-4'),
('01J8ALIAS0000000000OR_GPT54', '01J8MODEL3D26B2F9GPT540000', 'openai/gpt-5.4');

-- 4. Human display names for all models across DeepSWE, Harbor, and Aider
UPDATE models SET display_name = 'Fable 5' WHERE slug = 'fable-5';
UPDATE models SET display_name = 'Fable 5.1' WHERE slug = 'fable-5-1';
UPDATE models SET display_name = 'GPT-6 Astra' WHERE slug = 'gpt-6-astra';
UPDATE models SET display_name = 'GLM-5.3' WHERE slug = 'glm-5-3';
UPDATE models SET display_name = 'GLM-5.3 Flash' WHERE slug = 'glm-5-3-flash';
UPDATE models SET display_name = 'GLM-5.2' WHERE slug = 'glm-5-2';
UPDATE models SET display_name = 'GPT-5.5' WHERE slug = 'gpt-5-5';
UPDATE models SET display_name = 'GPT-5.4' WHERE slug = 'gpt-5-4';
UPDATE models SET display_name = 'GPT-5.6 Luna' WHERE slug = 'gpt-5-6-luna';
UPDATE models SET display_name = 'GPT-5.6 Sol' WHERE slug = 'gpt-5-6-sol';
UPDATE models SET display_name = 'GPT-5.6 Terra' WHERE slug = 'gpt-5-6-terra';
UPDATE models SET display_name = 'Claude Sonnet 4.6' WHERE slug = 'claude-sonnet-4-6';
UPDATE models SET display_name = 'DeepSeek V4 Flash' WHERE slug = 'deepseek-v4-flash';
UPDATE models SET display_name = 'DeepSeek V4 Pro' WHERE slug = 'deepseek-v4-pro';
UPDATE models SET display_name = 'Gemini 3.1 Pro Preview' WHERE slug = 'gemini-3-1-pro-preview';
UPDATE models SET display_name = 'Gemini 3.5 Flash' WHERE slug = 'gemini-3-5-flash';
UPDATE models SET display_name = 'Gemini 3.6 Flash' WHERE slug = 'gemini-3-6-flash';
UPDATE models SET display_name = 'Gemini 3.7 Flash' WHERE slug = 'gemini-3-7-flash';
UPDATE models SET display_name = 'Gemini 3.8 Flash' WHERE slug = 'gemini-3-8-flash';
UPDATE models SET display_name = 'Kimi K2.7 Code' WHERE slug = 'kimi-k2-7-code';
UPDATE models SET display_name = 'Kimi K3' WHERE slug = 'kimi-k3';
UPDATE models SET display_name = 'Muse Spark 1.1' WHERE slug = 'muse-spark-1-1';
UPDATE models SET display_name = 'Muse Spark 1.2' WHERE slug = 'muse-spark-1-2';
UPDATE models SET display_name = 'Qwen 3.8 Max' WHERE slug = 'qwen3-8-max';
UPDATE models SET display_name = 'Gemini 2.0 Flash Exp' WHERE slug = 'gemini-2-0-flash-exp';
UPDATE models SET display_name = 'Gemini 2.0 Flash Thinking Exp (01-21)' WHERE slug = 'gemini-2-0-flash-thinking-exp-01-21';
UPDATE models SET display_name = 'Gemini 2.0 Pro Exp (02-05)' WHERE slug = 'gemini-2-0-pro-exp-02-05';
UPDATE models SET display_name = 'Gemini 2.5 Flash Preview 04-17 (default)' WHERE slug = 'gemini-2-5-flash-preview-04-17-default';
UPDATE models SET display_name = 'Gemini 2.5 Flash Preview 05-20 (24k think)' WHERE slug = 'gemini-2-5-flash-preview-05-20-24k-think';
UPDATE models SET display_name = 'Gemini 2.5 Flash Preview 05-20 (no think)' WHERE slug = 'gemini-2-5-flash-preview-05-20-no-think';
UPDATE models SET display_name = 'Gemini 2.5 Pro Preview 03-25' WHERE slug = 'gemini-2-5-pro-preview-03-25';
UPDATE models SET display_name = 'Gemini 2.5 Pro Preview 05-06' WHERE slug = 'gemini-2-5-pro-preview-05-06';
UPDATE models SET display_name = 'Gemini 2.5 Pro Preview 06-05 (32k think)' WHERE slug = 'gemini-2-5-pro-preview-06-05-32k-think';
UPDATE models SET display_name = 'Gemini 2.5 Pro Preview 06-05 (default think)' WHERE slug = 'gemini-2-5-pro-preview-06-05-default-think';
UPDATE models SET display_name = 'Gemini Exp 1206' WHERE slug = 'gemini-exp-1206';
UPDATE models SET display_name = 'Gemma 3 27B IT' WHERE slug = 'gemma-3-27b-it';
UPDATE models SET display_name = 'GPT-4.1' WHERE slug = 'gpt-4-1';
UPDATE models SET display_name = 'GPT-4.1 Mini' WHERE slug = 'gpt-4-1-mini';
UPDATE models SET display_name = 'GPT-4.1 Nano' WHERE slug = 'gpt-4-1-nano';
UPDATE models SET display_name = 'GPT-4.5 Preview' WHERE slug = 'gpt-4-5-preview';
UPDATE models SET display_name = 'GPT-4o (2024-08-06)' WHERE slug = 'gpt-4o-2024-08-06';
UPDATE models SET display_name = 'GPT-4o (2024-11-20)' WHERE slug = 'gpt-4o-2024-11-20';
UPDATE models SET display_name = 'GPT-4o mini (2024-07-18)' WHERE slug = 'gpt-4o-mini-2024-07-18';
UPDATE models SET display_name = 'GPT-5' WHERE slug = 'gpt-5';
UPDATE models SET display_name = 'GPT-OSS 120B' WHERE slug = 'gpt-oss-120b';
UPDATE models SET display_name = 'Grok 4' WHERE slug = 'grok-4';
UPDATE models SET display_name = 'o1 (2024-12-17)' WHERE slug = 'o1-2024-12-17';
UPDATE models SET display_name = 'o1-mini (2024-09-12)' WHERE slug = 'o1-mini-2024-09-12';
UPDATE models SET display_name = 'o3 (high) + GPT-4.1' WHERE slug = 'o3-high-gpt-4-1';
UPDATE models SET display_name = 'OpenHands LM 32B v0.1' WHERE slug = 'openhands-lm-32b-v0-1';
UPDATE models SET display_name = 'Qwen Max (2025-01-25)' WHERE slug = 'qwen-max-2025-01-25';
UPDATE models SET display_name = 'Qwen 2.5 Coder 32B Instruct' WHERE slug = 'qwen2-5-coder-32b-instruct';
UPDATE models SET display_name = 'Qwen3 235B A22B diff (Alibaba API)' WHERE slug = 'qwen3-235b-a22b-diff-no-think-alibaba-api';
UPDATE models SET display_name = 'Qwen3 32B' WHERE slug = 'qwen3-32b';
UPDATE models SET display_name = 'Yi-Lightning' WHERE slug = 'yi-lightning';
