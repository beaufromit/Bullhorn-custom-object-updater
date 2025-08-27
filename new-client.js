// Load environment variables from this folder's .env
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const fs = require('fs');
const readline = require('readline');
const {
  getAuthorizationCodeWithCredentials,
  exchangeCodeForTokens,
  getBhRestToken,
} = require('./auth');

function updateEnvFile(newValues) {
  const envPath = path.resolve(__dirname, '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const envLines = envContent.split('\n');

  const updatedLines = envLines.map((line) => {
    const [key] = line.split('=');
    if (Object.prototype.hasOwnProperty.call(newValues, key)) {
      return `${key}=${newValues[key]}`;
    }
    return line;
  });

  for (const [key, value] of Object.entries(newValues)) {
    const exists = envLines.some((line) => line.startsWith(`${key}=`));
    if (!exists) {
      updatedLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
}

async function prompt(question, { mask = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (mask) {
      rl.stdoutMuted = true;
      rl._writeToOutput = function _writeToOutput(stringToWrite) {
        if (rl.stdoutMuted && stringToWrite !== '\n' && stringToWrite !== '\r\n') {
          rl.output.write('*');
        } else {
          rl.output.write(stringToWrite);
        }
      };
      // Print the question on its own line so it isn't masked
      console.log(question);
      rl.question('', (answer) => {
        rl.stdoutMuted = false;
        rl.close();
        console.log('');
        resolve(answer.trim());
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        console.log('');
        resolve(answer.trim());
      });
    }
  });
}

async function ensureBaseEnvInteractive() {
  const requiredKeys = ['CLIENT_ID', 'CLIENT_SECRET', 'BH_USERNAME', 'BH_PASSWORD'];
  const missing = requiredKeys.filter((k) => !process.env[k] || process.env[k] === '');

  const newValues = {};
  if (missing.length > 0) {
    console.log('Some required environment variables are missing. Please provide them to continue:');
    for (const key of missing) {
      // Only mask the actual password to avoid terminal quirks
      const isPassword = key === 'BH_PASSWORD';
      const answer = await prompt(`${key}: `, { mask: isPassword });
      if (!answer) {
        throw new Error(`A value for ${key} is required.`);
      }
      newValues[key] = answer;
      process.env[key] = answer; // make available immediately in this process
    }
  }

  // Prompt for region if missing or invalid
  const currentRegion = (process.env.BH_REGION || '').toUpperCase();
  if (!['EMEA', 'US'].includes(currentRegion)) {
    let region = (await prompt('BH_REGION (EMEA/US) [EMEA]: ')).toUpperCase();
    if (region !== 'EMEA' && region !== 'US') {
      region = 'EMEA';
    }
    newValues.BH_REGION = region;
    process.env.BH_REGION = region;
  }

  if (Object.keys(newValues).length > 0) {
    updateEnvFile(newValues);
    console.log('Saved credentials to .env.');
  }
}

// Immediately-invoked async function to follow the working auth flow
(async () => {
  try {
    await ensureBaseEnvInteractive();

    console.log('➡️  Getting authorization code via auth.js...');
    const code = await getAuthorizationCodeWithCredentials();
    if (!code) throw new Error('Authorization code not obtained.');
    console.log('✅ Authorization code obtained.');

    console.log('➡️  Exchanging code for tokens via auth.js...');
    const tokenData = await exchangeCodeForTokens(code); // { access_token, refresh_token }
    if (!tokenData?.access_token || !tokenData?.refresh_token) {
      throw new Error('Token exchange did not return access_token/refresh_token.');
    }
    console.log('✅ Access and refresh tokens obtained.');

    console.log('➡️  Getting BhRestToken and restUrl via auth.js...');
    const restData = await getBhRestToken(tokenData.access_token); // { BhRestToken, restUrl }
    if (!restData?.BhRestToken || !restData?.restUrl) {
      throw new Error('REST login did not return BhRestToken/restUrl.');
    }

    // Extract corpToken from restUrl
    const parts = restData.restUrl.split('/rest-services/');
    if (parts.length < 2) {
      throw new Error('Unexpected restUrl format; cannot extract corpToken.');
    }
    const corpToken = parts[1].replace(/\/$/, '');
    if (!corpToken) {
      throw new Error('Failed to parse corpToken from restUrl.');
    }
    console.log('✅ BhRestToken and corpToken retrieved.');

    // Update .env with all four values
    console.log('➡️  Writing tokens to .env...');
    updateEnvFile({
      ACCESS_TOKEN: tokenData.access_token,
      REFRESH_TOKEN: tokenData.refresh_token,
      BH_REST_TOKEN: restData.BhRestToken,
      CORP_TOKEN: corpToken,
    });
    console.log('✅ .env updated with CORP_TOKEN, ACCESS_TOKEN, REFRESH_TOKEN, BH_REST_TOKEN.');

    console.log('🎉 Bullhorn client onboarding complete.');
  } catch (error) {
    console.error('❌ Error during client onboarding:', error.message);
    process.exit(1);
  }
})();
