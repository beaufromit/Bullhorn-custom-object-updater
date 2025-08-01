require('dotenv').config(); // Load environment variables from .env file
const axios = require('axios');
const { renewAccessToken, getBhRestToken, recoverTokensAndRestToken, exchangeCodeForTokens,  } = require('./auth');
const corpToken = process.env.CORP_TOKEN;
const readline = require('readline');

let accessToken = '';
let refreshToken = process.env.REFRESH_TOKEN;
let BhRestToken = process.env.BH_REST_TOKEN;

let isRefreshing = false;
let refreshPromise = null;

// API caller wrapper for expired token handling
let consecutive401Errors = 0; // Global counter for consecutive 401 errors, protects against logs filling when all tokens are expired
async function makeApiCall(apiCallFunction, ...args) {
  const maxRetries = 6; // Maximum number of retries for transient errors
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await apiCallFunction(...args);
      consecutive401Errors = 0; // Reset the counter on a successful call
      return result;
    } catch (error) {
      

      // Handle specific error types
      if (error.code === 'ETIMEDOUT') {
        console.warn(`Timeout error occurred. Retrying (${attempt}/${maxRetries})...`);
      } else if (error.code === 'EAI_AGAIN') {
        console.warn(`DNS resolution error occurred. Retrying (${attempt}/${maxRetries})...`);
      } else if (error.code === 'ECONNRESET') {
        console.warn(`Connection reset error occurred. Retrying (${attempt}/${maxRetries})...`);
      } else if (error.response?.status === 401 || error.response?.data?.error === 'invalid_token') {
        console.log('Token expired. Renewing tokens...');
        consecutive401Errors++;

        if (consecutive401Errors >= 6) {
          console.error('Too many consecutive 401 errors. Stopping the script.');
          process.exit(1); // Exit the script if too many consecutive 401 errors occur
        }

        // --- Begin atomic refresh lock ---
        if (!isRefreshing) {
          isRefreshing = true;
          console.log('Token expired. Renewing tokens...');
          refreshPromise = (async () => {
            try {
              const tokenData = await renewAccessToken(refreshToken);
              const bhRestData = await getBhRestToken(tokenData.access_token);

              accessToken = tokenData.access_token;
              refreshToken = tokenData.refresh_token;
              BhRestToken = bhRestData.BhRestToken;

              console.log('Tokens renewed successfully.');
            } catch (tokenError) {
              console.error('Refresh token failed, attempting full re-auth...');
              try {
                const bhRest = await recoverTokensAndRestToken();
                require('dotenv').config();
                BhRestToken = bhRest.BhRestToken;
                accessToken = process.env.ACCESS_TOKEN;
                refreshToken = process.env.REFRESH_TOKEN;
                console.log('Full re-auth successful.');
              } catch (recoverError) {
                console.error('Full re-auth failed:', recoverError.message);
                throw recoverError;
              }
            } finally {
              isRefreshing = false;
            }
          })();
        } else {
          // Only log for the first call that triggers the refresh
          // Other calls will wait for the refresh to finish
        }
        await refreshPromise;
        // --- End atomic refresh lock ---

        continue; // Retry the original request with new token
      } else {
        console.error(`Unhandled error occurred: ${error.message}`);
        throw error; // Re-throw unhandled errors
      }

      // If max retries are reached, log and re-throw the error
      attempt++;
      if (attempt >= maxRetries) {
        console.error(`Max retries reached for error: ${error.message}`);
        throw error;
      }

      // Add a delay before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// async function makeApiCall(apiCallFunction, ...args) {
//   const maxRetries = 3; // Maximum number of retries for transient errors
//   let attempt = 0;

//   while (attempt < maxRetries) {
//     try {
//       const result = await apiCallFunction(...args);
//       consecutive401Errors = 0; // Reset the counter on a successful call
//       return result;
//     } catch (error) {
//       attempt++;

//       // Handle specific error types
//       if (error.code === 'ETIMEDOUT') {
//         console.warn(`Timeout error occurred. Retrying (${attempt}/${maxRetries})...`);
//       } else if (error.code === 'EAI_AGAIN') {
//         console.warn(`DNS resolution error occurred. Retrying (${attempt}/${maxRetries})...`);
//       } else if (error.code === 'ECONNRESET') {
//         console.warn(`Connection reset error occurred. Retrying (${attempt}/${maxRetries})...`);
//       } else if (error.response?.status === 401 || error.response?.data?.error === 'invalid_token') {
//         console.log('Token expired. Renewing tokens...');
//         consecutive401Errors++;

//         if (consecutive401Errors >= 3) {
//           console.error('Too many consecutive 401 errors. Stopping the script.');
//           process.exit(1); // Exit the script if too many consecutive 401 errors occur
//         }

//         try {
//           // Try to renew tokens
//           const tokenData = await renewAccessToken(refreshToken);
//           const bhRestData = await getBhRestToken(tokenData.access_token);

//           // Update global tokens
//           accessToken = tokenData.access_token;
//           refreshToken = tokenData.refresh_token;
//           BhRestToken = bhRestData.BhRestToken;

//           console.log('Tokens renewed successfully.');
//           continue; // Retry the original request
//         } catch (tokenError) {
//           console.error('Refresh token failed, attempting full re-auth...');
//           try {
//             // Full re-auth flow
//             const bhRest = await recoverTokensAndRestToken();

//               // Reload tokens from .env after update
//               require('dotenv').config();
//               BhRestToken = bhRest.BhRestToken;
//               accessToken = process.env.ACCESS_TOKEN;
//               refreshToken = process.env.REFRESH_TOKEN;
//             console.log('Full re-auth successful.');
//             continue; // Retry the original request
//           } catch (recoverError) {
//             console.error('Full re-auth failed:', recoverError.message);
//             throw recoverError; // Give up if full re-auth also fails
//   }
// }
//       } else {
//         console.error(`Unhandled error occurred: ${error.message}`);
//         throw error; // Re-throw unhandled errors
//       }

//       // If max retries are reached, log and re-throw the error
//       if (attempt >= maxRetries) {
//         console.error(`Max retries reached for error: ${error.message}`);
//         throw error;
//       }

//       // Add a delay before retrying (exponential backoff)
//       await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
//     }
//   }
// }

// Function to return query constants
function getQueryConstants() {
  return {
    recordIsNotDeleted: 'isDeleted:0',
    recordIsNotArchived: '!status:Archive',
    recordIsNotUpdated: '!customText26:yes',
    recordIsNotProcessing: '!customText26:processing',
    recordIsNotNewLead: '!status:"New Lead"',
    recordDateAdded: 'dateAdded:[20180525%20TO%20*]',
    // recordDateAdded: 'dateAdded:[2018-05-25%20TO%20*]',
    recordOwner: 'owner.id:17',
    id: 'id:165183',
    testCandidate: 'customText37:Yes',
    AND: '%20AND%20',
    OR: '%20OR%20',
    noCvAddedDate: '!customDate3:[*%20TO%20*]',
  };
}

// Helper function to build the query string - change string here if necessary
function buildQueryString() {
  const { recordIsNotDeleted, recordIsNotArchived, recordIsNotUpdated, recordIsNotProcessing, AND, OR } = getQueryConstants();
  return `${recordIsNotDeleted}${AND}${recordIsNotArchived}${AND}${recordIsNotUpdated}${OR}${recordIsNotProcessing}`;
}

// New: Build a query string for candidates for the Legitimate Interest script
function buildLegitimateInterestQueryString() {
  // Example: fetch all candidates (customize as needed)
  // You may want to filter out deleted/archived, but NOT by customText26
  const { recordIsNotDeleted, recordIsNotArchived, recordDateAdded, recordIsNotNewLead, AND } = getQueryConstants();
  return `${recordIsNotDeleted}${AND}${recordIsNotArchived}${AND}${recordIsNotNewLead}${AND}${recordDateAdded}` // Adjust the query as needed
}

function buildLegitimateInterestCustomObjectQuery() {
  // Adjust as needed to filter for candidates with customObject1s
  // You may need to filter in JS after fetching, as Bullhorn search may not support deep filtering
  const { recordIsNotDeleted, recordIsNotArchived, AND, recordIsNotNewLead, recordDateAdded} = getQueryConstants();
  return `${recordIsNotDeleted}${AND}${recordIsNotNewLead}${AND}${recordIsNotArchived}${AND}${recordDateAdded}`;
}

// Function to fetch all records 
async function getAllRecords() {
  return await makeApiCall(async () => {
    const allRecords = [];
    let start = 0;
    const count = 200; // Maximum number of records per request
    const queryString = buildQueryString();

    while (true) {
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/search/Candidate?BhRestToken=${getBhRestToken()}&query=${queryString}&fields=id,customObject1s(id,date1,date2,text2,text3)&sort=id&start=${start}&count=${count}`;
      console.log(`Fetching records starting from index ${start}...`);

      const response = await axios.get(url);
      const records = response.data.data;

      if (start === 0) {
        total = response.data.total; // Extract total count from the first response
      }

      if (records && records.length > 0) {
        allRecords.push(...records);
        start += records.length; // Move to the next batch
      } else {
        break; // Exit the loop if no more records are returned
      }
    }

    return { total, allRecords }; // Return total count and all records
  });
}

async function getAllCustomObjects(candidateId) {
  return await makeApiCall(async () => {
    const allCustomObjects = [];
    let start = 0;
    const count = 10; // Adjust this to the maximum allowed by the API

    while (true) {
      if (typeof getShouldStop === 'function' && getShouldStop()) {
        console.log(`Gracefully stopping fetch for Candidate ${candidateId}.`);
        break;
      }
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}/customObject1s?BhRestToken=${BhRestToken}&fields=id,date1,date2,text2,text3&start=${start}&count=${count}`;
      console.log(`Fetching customObject1s for Candidate ${candidateId}, starting from index ${start}...`);

      const response = await axios.get(url);
      const customObjects = response.data.data;

      if (customObjects && customObjects.length > 0) {
        allCustomObjects.push(...customObjects);
        start += customObjects.length; // Move to the next batch
      } else {
        break; // Exit the loop if no more custom objects are returned
      }
    }

    return allCustomObjects;
  });
}

// Function to prompt for confirmation
async function confirmToContinue() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Do you want to continue? (y/n): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y') {
        resolve(true);
      } else {
        console.log('Exiting script.');
        process.exit(0); // Exit the script if the user does not confirm
      }
    });
  });
}

function setupGracefulStop() {
  let shouldStop = false;
  process.on('SIGINT', () => {
    console.log('\nGracefully stopping the script. It will finish the current record and then exit.');
    shouldStop = true;
  });
  return () => shouldStop;
}

module.exports = {
  makeApiCall,
  getQueryConstants,
  buildQueryString,
  buildLegitimateInterestQueryString,
  buildLegitimateInterestCustomObjectQuery,
  getAllRecords,
  getAllCustomObjects,
  corpToken: process.env.CORP_TOKEN,
  // If you need BhRestToken, export a getter function for it:
  getBhRestToken: () => BhRestToken,
  confirmToContinue,
  setupGracefulStop
};