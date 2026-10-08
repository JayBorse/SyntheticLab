import * as fs from 'fs';
import * as path from 'path';
import { generateSyntheticPersonas } from '../src/core/synthetic-lab/persona-generator';
import { generateCompetitiveBattlecard } from '../src/core/synthetic-lab/battlecard-generator';
import { evaluatePersonaReaction, computeSimulationVerdict } from '../src/core/synthetic-lab/simulation-engine';
import { optimizeProductPitch } from '../src/core/synthetic-lab/optimizer';
import { executeHoldOutRetest } from '../src/core/synthetic-lab/holdout-retest';
import { SIMULATION_PRESETS } from '../src/core/synthetic-lab/presets';
import { GroundedEvidence, SimulationInput } from '../src/core/synthetic-lab/types';

async function main() {
  console.log('🚀 Running real live simulation for VectorStream AI preset to generate authentic savedRun replay...');
  
  const preset = SIMULATION_PRESETS.find((p) => p.id === 'devtools_api');
  if (!preset) throw new Error('Preset devtools_api not found');

  const input: SimulationInput = preset.input;
  const evidence: GroundedEvidence[] = preset.cachedEvidence;

  console.log('1. Generating 5 authentic personas for Cohort A...');
  const personas = await generateSyntheticPersonas(input, { count: 5 });

  console.log('2. Generating competitive battlecard from evidence...');
  const battlecard = await generateCompetitiveBattlecard(input, evidence);

  console.log('3. Running adversarial procurement evaluations for each persona...');
  const evaluations = await Promise.all(
    personas.map((p) => evaluatePersonaReaction(input, p, evidence, { battlecard }))
  );

  console.log('4. Computing empirical simulation verdict...');
  const verdict = computeSimulationVerdict(input, evaluations);

  console.log('5. Optimizing product pitch & packaging with Nemotron Ultra...');
  const optimizedPitch = await optimizeProductPitch(input, verdict, evidence);

  console.log('6. Running Hold-Out Retest on fresh Cohort B panel...');
  const holdOutResult = await executeHoldOutRetest(optimizedPitch, verdict, evidence, personas);

  const realRun = {
    personas,
    evaluations,
    verdict,
    optimizedPitch,
    holdOutResult,
  };

  const outputPath = path.resolve(process.cwd(), 'src/core/synthetic-lab/devtools-api-replay.json');
  fs.writeFileSync(outputPath, JSON.stringify(realRun, null, 2), 'utf-8');
  console.log(`✅ Saved authentic run replay to: ${outputPath}`);
}

main().catch((err) => {
  console.error('Failed to generate preset replay:', err);
  process.exit(1);
});
