import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import OpenAI from 'openai';
import { env } from '../src/config/env';

async function listNebiusModels() {
  const apiKey = process.env.NEBIUS_API_KEY || env.NEBIUS_API_KEY;
  const baseURL = process.env.NEBIUS_BASE_URL || env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1';

  console.log('\n==================================================');
  console.log('  SyntheticLab - Nebius Token Factory Discovery');
  console.log('==================================================');
  console.log(`Endpoint: ${baseURL}`);

  if (!apiKey) {
    console.log('\n⚠️  LIVE CREDENTIALS NOT CONFIGURED');
    console.log('To list available models, set NEBIUS_API_KEY in .env.local or your environment:');
    console.log('  export NEBIUS_API_KEY="your-key-here"');
    console.log('  export NEBIUS_BASE_URL="https://api.tokenfactory.nebius.com/v1"\n');
    return;
  }

  // Masked key display for verification without exposing secret
  const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '****';
  console.log(`Auth: Bearer ${maskedKey}`);
  console.log('Querying Nebius GET /v1/models ...\n');

  try {
    const client = new OpenAI({ apiKey, baseURL });
    const modelsList = await client.models.list();
    const models = modelsList.data || [];

    console.log(`✓ Successfully retrieved ${models.length} accessible models:\n`);

    const nemotronModels = models.filter((m) => m.id.toLowerCase().includes('nemotron'));

    if (nemotronModels.length > 0) {
      console.log('--- NVIDIA Nemotron Models ---');
      nemotronModels.forEach((m) => {
        console.log(`  ⭐ ${m.id} (owned by: ${m.owned_by || 'nvidia'})`);
      });
      console.log('');
    } else {
      console.log('ℹ️  No models with "nemotron" in ID found in this account.\n');
    }

    console.log('--- All Available Models ---');
    models.forEach((m, idx) => {
      console.log(`  ${idx + 1}. ${m.id}`);
    });

    console.log('\n--- Candidate Evaluation Check ---');
    const candidateSuper = models.find((m) => m.id.toLowerCase() === 'nvidia/nemotron-3-super-120b-a12b');
    const candidateUltra = models.find((m) => m.id.toLowerCase() === 'nvidia/nemotron-3-ultra-550b-a55b');

    console.log(`  nvidia/Nemotron-3-Super-120B-A12B: ${candidateSuper ? `✓ AVAILABLE (${candidateSuper.id})` : '✗ Not in catalog'}`);
    console.log(`  nvidia/Nemotron-3-Ultra-550B-A55B: ${candidateUltra ? `✓ AVAILABLE (${candidateUltra.id})` : '✗ Not in catalog'}`);
    console.log('\n==================================================\n');
  } catch (error) {
    console.error('\n❌ Failed to query Nebius models endpoint:');
    if (error && typeof error === 'object' && 'status' in error) {
      const err = error as { status?: number; message?: string };
      console.error(`HTTP Status: ${err.status}`);
      console.error(`Message: ${err.message}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    console.log('\n==================================================\n');
  }
}

listNebiusModels();
