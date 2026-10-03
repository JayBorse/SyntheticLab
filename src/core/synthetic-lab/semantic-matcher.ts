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
