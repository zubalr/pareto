// Compiled domain snapshot for Pick (Phase 12 freshness law) — general / math /
// science. Hand-compiled from the public tables named in COMPILED_SOURCES on
// 2026-09-08; NOT refreshed by a cron. Boards are kept only while their
// upstream last publish is on/after the 2026-03-08 freshness cutoff (see
// src/domains/registry.ts): AIME 2025 (deprecated/frozen) and GPQA Diamond
// (retired as saturated) are GONE — models that only scored there are dropped.
// Coverage-flagged: a missing score or priceOut is absent data (the row is
// omitted from budget filtering), never a plotted zero. Budget filtering on
// snapshot domains uses OpenRouter list $/M output as a PRICE PROXY — it is
// never $/task.

export const SNAPSHOT_RETRIEVED = "2026-09-08";

export type CompiledBenchKey = "mmlu-pro" | "aime-2026" | "scicode";

export interface CompiledBenchScore {
  /** Score in percent against the full benchmark. */
  pct: number;
  /** Key into COMPILED_SOURCES. */
  src: string;
  /** e.g. decoding/effort config as published, or "self-reported". */
  note?: string;
}

export interface CompiledModelRow {
  /** Maps onto the D1 models.slug when the model is obviously the same. */
  slug: string;
  displayName: string;
  /** OpenRouter list USD per 1M output tokens — price proxy, NOT $/task. */
  priceOut?: number;
  scores: Partial<Record<CompiledBenchKey, CompiledBenchScore>>;
}

export interface CompiledSource {
  name: string;
  url: string;
  retrieved: string;
  /** The upstream board's last publish / last-updated date we verified. */
  lastPublish: string;
  license: string;
  note: string;
}

export const COMPILED_SOURCES: Record<string, CompiledSource> = {
  "tiger-mmlu-pro": {
    name: "TIGER-Lab MMLU-Pro leaderboard (official results CSV)",
    url: "https://huggingface.co/datasets/TIGER-Lab/mmlu_pro_leaderboard_submission",
    retrieved: "2026-09-08",
    lastPublish: "2026-03-11",
    license: "MMLU-Pro dataset: MIT (per HF dataset card)",
    note: "Kept: last leaderboard update 2026.03.11 is on/after the 2026-03-08 cutoff. Rows flagged \"self-reported\" were contributed by model authors, not run by TIGER-Lab. 5-shot CoT unless noted.",
  },
  "matharena-aime-2026": {
    name: "MathArena AIME 2026 leaderboard (ETH SRI Lab)",
    url: "https://matharena.ai/?comp=aime--aime_2026",
    retrieved: "2026-09-08",
    lastPublish: "2026-09-08",
    license: "Published research leaderboard (see site); AIME problems © MAA",
    note: "Live board (AIME 2025 was deprecated/frozen and is thrown under the freshness law). Top of the board sits at the 100% ceiling — deltas up there are noise. Cost column is MathArena's measured USD per problem, not used as a budget here.",
  },
  "kaggle-scicode-sub": {
    name: "Kaggle Open Benchmarks — SciCode Subproblem Standard",
    url: "https://www.kaggle.com/benchmarks/open-benchmarks/scicode-subproblem-standard",
    retrieved: "2026-09-08",
    lastPublish: "2026-08-28",
    license: "Public benchmark table (SciCode; see linked dataset/license on the page)",
    note: "SciCode evaluated at subproblem level (338 subproblems), Kaggle-run — NOT the Artificial Analysis run. 53 models evaluated; the 11 rows shown on the public page unauthenticated are compiled here. Last updated 2026-08-28 (verified 2026-09-08).",
  },
  openrouter: {
    name: "OpenRouter Models API — list prices",
    url: "https://openrouter.ai/api/v1/models",
    retrieved: "2026-09-08",
    lastPublish: "2026-09-08",
    license: "Public API metadata",
    note: "priceOut = list completion price × 1M. A price proxy for budgeting — never $/task, which only measured agent runs can produce.",
  },
};

export const COMPILED_SCORES: CompiledModelRow[] = [
  {
    "slug": "claude-3-5-sonnet-20241022",
    "displayName": "Claude 3.5 Sonnet (2024-10-22)",
    "scores": {
      "mmlu-pro": {
        "pct": 78,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "claude-3-7-sonnet-20250219",
    "displayName": "Claude 3.7 Sonnet",
    "scores": {
      "mmlu-pro": {
        "pct": 84,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "claude-4-opus-20250514",
    "displayName": "Claude Opus 4",
    "scores": {
      "mmlu-pro": {
        "pct": 87.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 75
  },
  {
    "slug": "claude-4-sonnet",
    "displayName": "Claude Sonnet 4",
    "scores": {
      "mmlu-pro": {
        "pct": 83.7,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 15
  },
  {
    "slug": "claude-opus-4-5",
    "displayName": "Claude Opus 4.5",
    "scores": {
      "mmlu-pro": {
        "pct": 87.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 25
  },
  {
    "slug": "claude-opus-4-6",
    "displayName": "Claude Opus 4.6",
    "scores": {
      "mmlu-pro": {
        "pct": 89.1,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 96.67,
        "src": "matharena-aime-2026",
        "note": "high"
      }
    },
    "priceOut": 25
  },
  {
    "slug": "claude-opus-4-8",
    "displayName": "Opus 4.8",
    "scores": {
      "aime-2026": {
        "pct": 100,
        "src": "matharena-aime-2026",
        "note": "max"
      },
      "scicode": {
        "pct": 38.1,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 25
  },
  {
    "slug": "claude-opus-5",
    "displayName": "Claude Opus 5",
    "scores": {
      "scicode": {
        "pct": 42.6,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 25
  },
  {
    "slug": "claude-sonnet-4-5",
    "displayName": "Claude Sonnet 4.5",
    "scores": {
      "mmlu-pro": {
        "pct": 87.4,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 15
  },
  {
    "slug": "claude-sonnet-4-6",
    "displayName": "Claude Sonnet 4.6",
    "scores": {
      "mmlu-pro": {
        "pct": 87.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 15
  },
  {
    "slug": "deepseek-r1",
    "displayName": "DeepSeek R1",
    "scores": {
      "mmlu-pro": {
        "pct": 84,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 2.5
  },
  {
    "slug": "deepseek-r1-0528",
    "displayName": "DeepSeek R1 (0528)",
    "scores": {
      "mmlu-pro": {
        "pct": 83.4,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 2.15
  },
  {
    "slug": "deepseek-v3-0324",
    "displayName": "DeepSeek V3 (0324)",
    "scores": {
      "mmlu-pro": {
        "pct": 81.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 1
  },
  {
    "slug": "deepseek-v3-2-reasoner",
    "displayName": "DeepSeek V3.2 (Reasoner)",
    "scores": {
      "mmlu-pro": {
        "pct": 85,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 94.17,
        "src": "matharena-aime-2026",
        "note": "think"
      }
    },
    "priceOut": 0.4
  },
  {
    "slug": "deepseek-v4-flash",
    "displayName": "DeepSeek V4 Flash",
    "scores": {
      "aime-2026": {
        "pct": 95.83,
        "src": "matharena-aime-2026",
        "note": "max"
      }
    },
    "priceOut": 0.28
  },
  {
    "slug": "deepseek-v4-pro",
    "displayName": "DeepSeek V4 Pro",
    "scores": {
      "aime-2026": {
        "pct": 96.67,
        "src": "matharena-aime-2026",
        "note": "max"
      }
    },
    "priceOut": 1.98
  },
  {
    "slug": "gemini-2-0-flash",
    "displayName": "Gemini 2.0 Flash",
    "scores": {
      "mmlu-pro": {
        "pct": 77.6,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "gemini-2-5-pro",
    "displayName": "Gemini 2.5 Pro",
    "scores": {
      "mmlu-pro": {
        "pct": 86,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 10
  },
  {
    "slug": "gemini-2-5-pro-preview-03-25",
    "displayName": "Gemini 2.5 Pro (03-25)",
    "scores": {
      "mmlu-pro": {
        "pct": 84.5,
        "src": "tiger-mmlu-pro"
      }
    }
  },
  {
    "slug": "gemini-3-1-pro-preview",
    "displayName": "Gemini 3.1 Pro Preview",
    "scores": {
      "mmlu-pro": {
        "pct": 91.2,
        "src": "tiger-mmlu-pro"
      },
      "aime-2026": {
        "pct": 98.33,
        "src": "matharena-aime-2026"
      }
    },
    "priceOut": 12
  },
  {
    "slug": "gemini-3-5-flash",
    "displayName": "Gemini 3.5 Flash",
    "scores": {
      "aime-2026": {
        "pct": 95,
        "src": "matharena-aime-2026"
      },
      "scicode": {
        "pct": 39.5,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 9
  },
  {
    "slug": "gemini-3-6-flash",
    "displayName": "Gemini 3.6 Flash",
    "scores": {
      "aime-2026": {
        "pct": 96.67,
        "src": "matharena-aime-2026"
      },
      "scicode": {
        "pct": 37.8,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 3.75
  },
  {
    "slug": "gemini-3-7-flash",
    "displayName": "Gemini 3.7 Flash",
    "scores": {
      "scicode": {
        "pct": 43,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 3.75
  },
  {
    "slug": "gemini-3-flash-preview",
    "displayName": "Gemini 3 Flash (12/25)",
    "scores": {
      "mmlu-pro": {
        "pct": 88.6,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 96.67,
        "src": "matharena-aime-2026"
      }
    },
    "priceOut": 3
  },
  {
    "slug": "gemini-3-pro-preview",
    "displayName": "Gemini 3 Pro (preview)",
    "scores": {
      "mmlu-pro": {
        "pct": 90.1,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 91.67,
        "src": "matharena-aime-2026",
        "note": "preview"
      },
      "scicode": {
        "pct": 39.4,
        "src": "kaggle-scicode-sub"
      }
    }
  },
  {
    "slug": "glm-4-5",
    "displayName": "GLM-4.5",
    "scores": {
      "mmlu-pro": {
        "pct": 84.6,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 2.2
  },
  {
    "slug": "glm-5",
    "displayName": "GLM-5",
    "scores": {
      "mmlu-pro": {
        "pct": 86,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 96.67,
        "src": "matharena-aime-2026"
      }
    },
    "priceOut": 1.92
  },
  {
    "slug": "glm-5-2",
    "displayName": "GLM-5.2",
    "scores": {
      "aime-2026": {
        "pct": 90,
        "src": "matharena-aime-2026"
      }
    },
    "priceOut": 3.036
  },
  {
    "slug": "gpt-4-1",
    "displayName": "GPT-4.1",
    "scores": {
      "mmlu-pro": {
        "pct": 81.8,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 8
  },
  {
    "slug": "gpt-4-5-preview",
    "displayName": "GPT-4.5 Preview",
    "scores": {
      "mmlu-pro": {
        "pct": 86.1,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "gpt-4o-2024-05-13",
    "displayName": "GPT-4o (2024-05-13)",
    "scores": {
      "mmlu-pro": {
        "pct": 72.6,
        "src": "tiger-mmlu-pro"
      }
    },
    "priceOut": 15
  },
  {
    "slug": "gpt-4o-2024-08-06",
    "displayName": "GPT-4o (2024-08-06)",
    "scores": {
      "mmlu-pro": {
        "pct": 74.7,
        "src": "tiger-mmlu-pro"
      }
    },
    "priceOut": 10
  },
  {
    "slug": "gpt-4o-2024-11-20",
    "displayName": "GPT-4o (2024-11-20)",
    "scores": {
      "mmlu-pro": {
        "pct": 77.9,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 10
  },
  {
    "slug": "gpt-5",
    "displayName": "GPT-5",
    "scores": {
      "mmlu-pro": {
        "pct": 87.1,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 10
  },
  {
    "slug": "gpt-5-1-2025-11-13",
    "displayName": "GPT-5.1",
    "scores": {
      "mmlu-pro": {
        "pct": 86.4,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 10
  },
  {
    "slug": "gpt-5-2",
    "displayName": "GPT-5.2",
    "scores": {
      "mmlu-pro": {
        "pct": 87.4,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 98.33,
        "src": "matharena-aime-2026",
        "note": "high"
      }
    },
    "priceOut": 14
  },
  {
    "slug": "gpt-5-4",
    "displayName": "GPT-5.4",
    "scores": {
      "mmlu-pro": {
        "pct": 87.5,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "aime-2026": {
        "pct": 99.17,
        "src": "matharena-aime-2026",
        "note": "xhigh"
      }
    },
    "priceOut": 15
  },
  {
    "slug": "gpt-5-5",
    "displayName": "GPT-5.5",
    "scores": {
      "aime-2026": {
        "pct": 100,
        "src": "matharena-aime-2026",
        "note": "xhigh"
      }
    },
    "priceOut": 30
  },
  {
    "slug": "gpt-5-6-sol",
    "displayName": "GPT-5.6 Sol",
    "scores": {
      "scicode": {
        "pct": 42.6,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 10
  },
  {
    "slug": "gpt-5-6-terra",
    "displayName": "GPT-5.6 Terra",
    "scores": {
      "scicode": {
        "pct": 39.2,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 12
  },
  {
    "slug": "gpt-oss-120b",
    "displayName": "GPT-OSS 120B",
    "scores": {
      "mmlu-pro": {
        "pct": 80.8,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 0.17
  },
  {
    "slug": "grok-3-beta",
    "displayName": "Grok 3",
    "scores": {
      "mmlu-pro": {
        "pct": 79.9,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "grok-3-mini-beta",
    "displayName": "Grok 3 Mini",
    "scores": {
      "mmlu-pro": {
        "pct": 83,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "grok-4",
    "displayName": "Grok 4",
    "scores": {
      "mmlu-pro": {
        "pct": 87,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "grok-4-5",
    "displayName": "Grok 4.5",
    "scores": {
      "scicode": {
        "pct": 41.9,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 6
  },
  {
    "slug": "kimi-k2-5",
    "displayName": "Kimi K2.5",
    "scores": {
      "aime-2026": {
        "pct": 95.83,
        "src": "matharena-aime-2026",
        "note": "think"
      }
    },
    "priceOut": 2.25
  },
  {
    "slug": "kimi-k2-instruct",
    "displayName": "Kimi K2 Instruct",
    "scores": {
      "mmlu-pro": {
        "pct": 81,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "kimi-k3",
    "displayName": "Kimi K3",
    "scores": {
      "aime-2026": {
        "pct": 96.67,
        "src": "matharena-aime-2026",
        "note": "think"
      }
    },
    "priceOut": 15
  },
  {
    "slug": "llama-4-maverick",
    "displayName": "Llama 4 Maverick",
    "scores": {
      "mmlu-pro": {
        "pct": 80.5,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 0.696
  },
  {
    "slug": "llama-4-scout-instruct",
    "displayName": "Llama 4 Scout",
    "scores": {
      "mmlu-pro": {
        "pct": 74.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 0.3
  },
  {
    "slug": "minimax-m2",
    "displayName": "MiniMax M2",
    "scores": {
      "mmlu-pro": {
        "pct": 82,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 1.02
  },
  {
    "slug": "minimax-m2-5",
    "displayName": "MiniMax M2.5",
    "scores": {
      "mmlu-pro": {
        "pct": 80.1,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 1.08
  },
  {
    "slug": "o1-2024-12-17",
    "displayName": "o1",
    "scores": {
      "mmlu-pro": {
        "pct": 89.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 60
  },
  {
    "slug": "o1-mini-2024-09-12",
    "displayName": "o1-mini",
    "scores": {
      "mmlu-pro": {
        "pct": 80.3,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "o3",
    "displayName": "o3",
    "scores": {
      "mmlu-pro": {
        "pct": 85,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      },
      "scicode": {
        "pct": 36.4,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 8
  },
  {
    "slug": "o3-mini",
    "displayName": "o3-mini",
    "scores": {
      "mmlu-pro": {
        "pct": 79.4,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 4.4
  },
  {
    "slug": "o4-mini",
    "displayName": "o4 mini",
    "scores": {
      "scicode": {
        "pct": 36.1,
        "src": "kaggle-scicode-sub"
      }
    },
    "priceOut": 4.4
  },
  {
    "slug": "qwen-max-2025-01-25",
    "displayName": "Qwen 2.5 Max",
    "scores": {
      "mmlu-pro": {
        "pct": 76.1,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  },
  {
    "slug": "qwen3-235b-a22b-diff-no-think-alibaba-api",
    "displayName": "Qwen3 235B A22B Instruct-2507",
    "scores": {
      "mmlu-pro": {
        "pct": 83,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    },
    "priceOut": 0.55
  },
  {
    "slug": "qwq-32b",
    "displayName": "QwQ-32B",
    "scores": {
      "mmlu-pro": {
        "pct": 71,
        "src": "tiger-mmlu-pro",
        "note": "self-reported"
      }
    }
  }
];
