import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { nebiusNemotron } from '../src/core/ai/nebius';

async function testSyntheticLab() {
  console.log('\n==================================================');
  console.log('  SyntheticLab - Nebius Token Factory Verification');
  console.log('==================================================');

  const ultraModel = process.env.NEBIUS_ULTRA_MODEL_ID || 'nvidia/Nemotron-3-Ultra-550b-a55b';
  const superModel = process.env.NEBIUS_SUPER_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b';

  console.log(`Ultra Strategy Model: ${ultraModel}`);
  console.log(`Super Swarm Model:    ${superModel}`);

  try {
    console.log('\nTesting Ultra reasoning completion...');
    const t0 = Date.now();
    const ultraRes = await nebiusNemotron.chat(
      [{ role: 'user', content: 'In 1 sentence, explain why CFOs reject variable usage pricing.' }],
      { modelId: ultraModel, maxTokens: 100 }
    );
    console.log(`✓ Ultra responded in ${Date.now() - t0}ms:`);
    console.log(`  "${ultraRes.text.trim()}"`);

    console.log('\nTesting Super swarm persona evaluation...');
    const t1 = Date.now();
    const superRes = await nebiusNemotron.chat(
      [
        { role: 'system', content: 'You output only valid JSON.' },
        {
          role: 'user',
          content: 'Output JSON: {"role": "enterprise_cfo", "vote": "reject", "acceptablePrice": 35}',
        },
      ],
      { modelId: superModel, responseFormat: 'json_object', maxTokens: 100 }
    );
    console.log(`✓ Super responded in ${Date.now() - t1}ms:`);
    console.log(`  ${superRes.text.trim()}`);

    console.log('\n==================================================');
    console.log('  All SyntheticLab Model Connections Verified!');
    console.log('==================================================\n');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testSyntheticLab().catch(console.error);
