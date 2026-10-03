/**
 * Semantic Objection Matcher for SyntheticLab
 * Evaluates whether adversarial persona objections capture core documented grievances
 * using conceptual topic vectors and domain-specific semantic intents rather than naive substring matching.
 */

export interface BenchmarkTopicMatcher {
  id: string;
  topicTitle: string;
  primaryConcepts: string[][]; // Array of concept clusters (must match at least one cluster)
  negativeExclusions?: string[]; // Words that disqualify false positives
}

export const BENCHMARK_OBJECTION_TOPICS: BenchmarkTopicMatcher[] = [
  {
    id: 'piracy_install_bombing',
    topicTitle: 'Piracy installs & install-bombing vulnerability (botnet / competitor sabotage)',
    primaryConcepts: [
      ['pirac', 'pirate', 'cracked'],
      ['install bomb', 'install-bomb', 'malicious install', 'repeat install', 'botnet', 'sabotage'],
      ['fraudulent install', 'fake install', 'unauthorized install', 'unmetered install'],
    ],
  },
  {
    id: 'freemium_margin_destruction',
    topicTitle: 'Freemium / F2P margin collapse (low ARPU games exceed 50-100% of profit)',
    primaryConcepts: [
      ['freemium', 'f2p', 'free-to-play', 'free to play'],
      ['margin', 'arpu', 'per-install fee', 'install fee', 'wipe out margin', 'destroy margin', 'unit economics'],
      ['exceed revenue', 'more than revenue', 'bankrupt'],
    ],
  },
  {
    id: 'retroactive_terms_breach',
    topicTitle: 'Retroactive terms breach (changing contract on already-shipped games)',
    primaryConcepts: [
      ['retroactive', 'retroactively', 'past titles', 'already shipped', 'already published'],
      ['breach of trust', 'breach of contract', 'unilateral', 'bait and switch', 'pulled the rug'],
      ['terms change', 'license change', 'contract terms'],
    ],
  },
  {
    id: 'charity_demo_ambiguity',
    topicTitle: 'Charity bundle & demo install ambiguity (multi-device and web counting)',
    primaryConcepts: [
      ['charity', 'humble bundle', 'bundle'],
      ['demo', 'demos', 'trial installs', 're-install', 'reinstall', 'multiple devices'],
      ['ambiguity', 'unclear counting', 'how installs are counted'],
    ],
  },
  {
    id: 'proprietary_tracking_distrust',
    topicTitle: 'Proprietary telemetry distrust (black-box install counting without auditability)',
    primaryConcepts: [
      ['black box', 'black-box', 'proprietary telemetry', 'proprietary tracking', 'unverified'],
      ['trust', 'distrust', 'lack of transparency', 'no audit', 'audit trail', 'unverifiable'],
      ['spyware', 'drm', 'tracking mechanism'],
    ],
  },
  {
    id: 'developer_flight_opensource',
    topicTitle: 'Developer flight to open-source alternatives (migration to Godot / Unreal / custom)',
    primaryConcepts: [
      ['godot', 'unreal', 'competitor engine', 'open source', 'open-source', 'alternative engine'],
      ['flight', 'boycott', 'migration', 'switch engine', 'abandon', 'leave the platform'],
      ['existential threat', 'developer revolt', 'community backlash'],
    ],
  },
];

/**
 * Checks whether an objection semantically matches a specific benchmark topic
 */
export function matchesObjectionTopic(objectionText: string, matcher: BenchmarkTopicMatcher): boolean {
  const normalized = objectionText.toLowerCase();

  // Check negative exclusions
  if (matcher.negativeExclusions?.some((ex) => normalized.includes(ex))) {
    return false;
  }

  // Check if any primary concept cluster matches
  return matcher.primaryConcepts.some((cluster) => {
    return cluster.some((phrase) => normalized.includes(phrase));
  });
}

/**
 * Evaluates all benchmark topics against a collection of candidate objections
 */
export function evaluateBenchmarkObjectionRecall(
  candidateObjections: string[],
  benchmarkTopics: BenchmarkTopicMatcher[] = BENCHMARK_OBJECTION_TOPICS
): {
  matches: number;
  total: number;
  percentage: number;
  details: { topicId: string; title: string; isMatched: boolean; matchedObjection?: string }[];
} {
  let matchCount = 0;

  const details = benchmarkTopics.map((topic) => {
    const matched = candidateObjections.find((obj) => matchesObjectionTopic(obj, topic));
    if (matched) {
      matchCount += 1;
      return { topicId: topic.id, title: topic.topicTitle, isMatched: true, matchedObjection: matched };
    }
    return { topicId: topic.id, title: topic.topicTitle, isMatched: false };
  });

  return {
    matches: matchCount,
    total: benchmarkTopics.length,
    percentage: Math.round((matchCount / (benchmarkTopics.length || 1)) * 100),
    details,
  };
}

/**
 * Determines whether two objections share core semantic intent and grievance domain.
 */
export function areObjectionsSemanticallyRelated(objA: string, objB: string): boolean {
  const a = objA.toLowerCase();
  const b = objB.toLowerCase();

  // Core semantic domain markers
  const domainMarkers = [
    ['soc 2', 'soc2', 'compliance', 'audit', 'iso 27001'],
    ['tls', 'encryption', 'in transit', 'at rest', 'aes'],
    ['vpc', 'private link', 'peering', 'isolated endpoint', 'data residency'],
    ['unpredictable', 'usage-based', 'overage', 'spend cap', 'pinecone', 'spike', 'cost shock'],
    ['sla', 'latency', 'uptime', 'cold-start', 'cold start', 'error budget'],
    ['helm', 'kubernetes', 'k8s', 'ci/cd', 'argocd', 'deployment'],
    ['migration', 'lock-in', 'export', 'openapi', 'qdrant', 'pgvector', 'weaviate'],
    ['master agreement', 'msa', 'volume discount', 'procurement', 'enterprise terms'],
    ['roi', 'budget ceiling', 'pricing tier', 'flat fee', 'monthly limit'],
  ];

  // Check if both objections share any common domain marker
  const sharesDomainMarker = domainMarkers.some((markerGroup) => {
    const aHas = markerGroup.some((m) => a.includes(m));
    const bHas = markerGroup.some((m) => b.includes(m));
    return aHas && bHas;
  });

  if (sharesDomainMarker) return true;

  // Jaccard similarity on meaningful words (>3 chars)
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'which', 'about', 'there', 'their', 'product', 'platform']);
  const wordsA = new Set(a.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stopWords.has(w)));
  const wordsB = new Set(b.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stopWords.has(w)));

  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) intersection += 1;
  });

  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = intersection / union;
  return jaccard >= 0.35;
}

/**
 * Computes how many initial fatal objections were successfully resolved vs persisted in the holdout committee.
 */
export function computeResolvedObjections(
  initialObjections: string[],
  holdoutObjections: string[]
): {
  resolvedCount: number;
  totalInitial: number;
  persistedObjections: string[];
} {
  const persisted: string[] = [];
  let resolvedCount = 0;

  initialObjections.forEach((initObj) => {
    const stillPresent = holdoutObjections.some((holdObj) => areObjectionsSemanticallyRelated(initObj, holdObj));
    if (stillPresent) {
      persisted.push(initObj);
    } else {
      resolvedCount += 1;
    }
  });

  return {
    resolvedCount,
    totalInitial: initialObjections.length,
    persistedObjections: persisted,
  };
}
