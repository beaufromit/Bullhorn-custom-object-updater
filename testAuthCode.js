const axios = require('axios');
const url = require('url');
require('dotenv').config();

async function getAuthorizationCodeWithCredentials() {
  const clientId = process.env.CLIENT_ID;
  const username = process.env.BH_USERNAME;
  const password = process.env.BH_PASSWORD;

  const authUrl = `https://auth.bullhornstaffing.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=Login`;

  console.log('Authorization URL:', authUrl); // <-- Print the URL being used
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

// Run the function and print the code
getAuthorizationCodeWithCredentials()
  .then(code => {
    if (!code) {
      console.log('No code returned.');
    }
  })
  .catch(err => {
  if (err.response && err.response.data) {
    console.error('Response body:', err.response.data);
  }
  console.error('Error getting authorization code:', err.message);
});