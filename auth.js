const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

// Export the functions
module.exports = { renewAccessToken, getBhRestToken, updateEnvFile };