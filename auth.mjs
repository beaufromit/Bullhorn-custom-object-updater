const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Get new access token using credenials when refresh token fails
async function getAuthorizationCodeWithCredentials() {
  const clientId = process.env.CLIENT_ID;
  const username = process.env.BH_USERNAME;
  const password = process.env.BH_PASSWORD;

  const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=Login`;

  console.log('Authorization URL:', authUrl);
  try {
    const response = await axios.get(authUrl, {
      maxRedirects: 0,
      validateStatus: (status) => status === 302
    });

    const location = response.headers.location;
    if (location) {
      const parsed = url.parse(location, true);
      const code = parsed.query.code;
      if (code) {
        console.log('Authorization code obtained:', code);
        return code;
      }
    }
    throw new Error('Authorization code not found in redirect URL.');
  } catch (error) {
    if (error.response && error.response.status === 302) {
      const location = error.response.headers.location;
      const parsed = url.parse(location, true);
      const code = parsed.query.code;
      if (code) {
        console.log('Authorization code obtained:', code);
        return code;
      }
      throw new Error('Authorization code not found in redirect URL.');
    }
    throw error;
  }
}

//Exchange code for tokens
async function exchangeCodeForTokens(code) {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  
  const url = 'https://auth.bullhornstaffing.com/oauth/token';
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  try {
    const response = await axios.post(url, params);
    console.log('Tokens obtained:', response.data);

    // Optionally update .env here
    updateEnvFile({
      REFRESH_TOKEN: response.data.refresh_token,
      ACCESS_TOKEN: response.data.access_token,
    });

    return response.data; // Contains access_token and refresh_token
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    throw error;
  }
}

//Function to refresh access token
async function renewAccessToken(refreshToken) {
  const url = `https://auth-emea.bullhornstaffing.com/oauth/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}`;
  try {
    const response = await axios.post(url);
    console.log('Access token renewed:', response.data);

    // Update the .env file with the new tokens
    updateEnvFile({
      REFRESH_TOKEN: response.data.refresh_token,
      ACCESS_TOKEN: response.data.access_token,
    });

    return response.data; // Contains access_token and refresh_token
  } catch (error) {
    console.error('Error renewing access token:', error.response?.data || error.message);
    throw error;
  }
}

// Function to get BhRestToken using access token
async function getBhRestToken(accessToken) {
  const url = `https://rest-emea.bullhornstaffing.com/rest-services/login?version=2.0&access_token=${accessToken}`;
  try {
    const response = await axios.get(url);
    console.log('BhRestToken retrieved:', response.data);

    // Update the .env file with the new BhRestToken
    updateEnvFile({
      BH_REST_TOKEN: response.data.BhRestToken,
    });

    return response.data; // Contains BhRestToken and restUrl
  } catch (error) {
    console.error('Error retrieving BhRestToken:', error.response?.data || error.message);
    throw error;
  }
}

//recover login from start of flow
async function recoverTokensAndRestToken() {
  // 1. Get new authorization code
  const code = await getAuthorizationCodeWithCredentials();

  // 2. Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  // 3. Get BhRestToken using new access token
  const bhRest = await getBhRestToken(tokens.access_token);

  // .env will be updated with new tokens and BhRestToken
  return bhRest;
}

// Function to update the .env file with new tokens
function updateEnvFile(newValues) {
  const envPath = path.resolve(__dirname, '.env');
  const envVars = fs.readFileSync(envPath, 'utf8').split('\n');

  // Update the relevant variables
  const updatedEnvVars = envVars.map(line => {
    const [key, value] = line.split('=');
    if (newValues[key]) {
      return `${key}=${newValues[key]}`;
    }
    return line;
  });

  // Write the updated variables back to the .env file
  fs.writeFileSync(envPath, updatedEnvVars.join('\n'), 'utf8');
  console.log('.env file updated with new tokens.');
}

export {
    recoverTokensAndRestToken,
    exchangeCodeForTokens,
    getAuthorizationCodeWithCredentials,
    renewAccessToken,
    getBhRestToken,
  };