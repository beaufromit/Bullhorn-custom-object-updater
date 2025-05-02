// This script is designed to interact with the Bullhorn API to update custom objects for candidates. It swaps the date1 and date2 fields of customObject1s for candidates that are not marked as 'Herefish' in the text3 field. The script handles token renewal and error logging.

require('dotenv').config(); // Load environment variables from .env file
const { setupLogging } = require('./logging');
const { renewAccessToken, getBhRestToken } = require('./auth');
const axios = require('axios');
const corpToken = process.env.CORP_TOKEN;

let accessToken = '';
let refreshToken = process.env.REFRESH_TOKEN;
let BhRestToken = process.env.BH_REST_TOKEN;


// API caller wrapper for expired token handling
let consecutive401Errors = 0; // Global counter for consecutive 401 errors, protects against logs filling when all tokens are expired
async function makeApiCall(apiCallFunction, ...args) {
  try {
    const result = await apiCallFunction(...args);
    consecutive401Errors = 0; // Reset the counter on a successful call
    return result;
  } catch (error) {
    // Check if the error is due to an expired BhRestToken
    if (error.response?.status === 401 || error.response?.data?.error === 'invalid_token') {
      console.log('Token expired. Renewing tokens...');
      consecutive401Errors++; // Increment the counter for 401 errors

      if (consecutive401Errors >= 3) {
        console.error('Too many consecutive 401 errors. Stopping the script.');
        throw new Error('Too many consecutive 401 errors.');
      }

      try {
        // Renew the access token and BhRestToken
        const tokenData = await renewAccessToken(refreshToken);
        const bhRestData = await getBhRestToken(tokenData.access_token);

        // Update global tokens
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token;
        BhRestToken = bhRestData.BhRestToken;

        console.log('Retrying the failed request...');
        return await apiCallFunction(...args); // Retry the failed request
      } catch (tokenError) {
        console.error('Error renewing tokens:', tokenError.response?.data || tokenError.message);
        throw tokenError; // Re-throw if token renewal fails
      }
    } else {
      throw error; // Re-throw other errors
    }
  }
}

// Function to fetch all records 
async function getAllRecords() {
  return await makeApiCall(async () => {
    const allRecords = [];
    let start = 0;
    const count = 200; // Maximum number of records per request
    const recordIsNotDeleted = 'isDeleted:0';
    const recordIsNotArchived = '!status:Archive';
    const recordIsNotUpdated = '!customText26:yes';
    const TestCandidate = 'customText37:yes';
    const AND = '%20AND%20';



    while (true) {
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/search/Candidate?BhRestToken=${BhRestToken}&query=${recordIsNotDeleted}${AND}${recordIsNotArchived}${AND}${recordIsNotUpdated}${AND}${TestCandidate}&fields=id,customObject1s(id,date1,date2,text3)&sort=id&start=${start}&count=${count}`;
      console.log(`Fetching records starting from index ${start}...`);

      const response = await axios.get(url);
      const records = response.data.data;

      if (records && records.length > 0) {
        allRecords.push(...records);
        start += records.length; // Move to the next batch
      } else {
        break; // Exit the loop if no more records are returned
      }
    }

    return allRecords;
  });
}
 
// Main function to swap dates for all records 
async function getAllCustomObjects(candidateId) {
  return await makeApiCall(async () => {
    const allCustomObjects = [];
    let start = 0;
    const count = 10; // Adjust this to the maximum allowed by the API

    while (true) {
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}/customObject1s?BhRestToken=${BhRestToken}&fields=id,date1,date2,text3&start=${start}&count=${count}`;
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

// Function to update a record 
async function updateRecord(candidateId, customObjectId, date1, date2) {
  return await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${BhRestToken}`;
    const payload = {
      "customObject1s":[{
      "id": customObjectId,
      "date1": date2, 
      "date2": date1
      }],
      "customText26": "Processing" // Mark the candidate as processed
    }; 

    try {
      await axios.post(url, payload, {
        headers: {  
          'Content-Type': 'application/json'
        }
      });
      console.log(`Successfully updated CustomObject ${customObjectId} for Candidate ${candidateId}. Payload: `, payload);
    } catch (error) {
      console.error(`Error updating CustomObject ${customObjectId} for Candidate ${candidateId}:`, error.response?.data || error.message);
    }
  }); 
}

//Function to coordinate getAllRecords, getAllCustomObjects and updateRecord
async function swapDates() {
  try {
    const records = await getAllRecords();
    for (const record of records) {
      const candidateId = record.id; // Extract the candidate ID

      try {
        const customObjects = await getAllCustomObjects(candidateId); // Fetch all customObject1s for this candidate

        if (customObjects && customObjects.length > 0) {
          for (const customObject of customObjects) {
            const { id: customObjectId, date1, date2, text3 } = customObject;

            // Skip the update if text3 is 'Herefish'
            if (text3 === 'Herefish') {
              console.log(
                `Skipping update for customObject ${customObjectId} of Candidate ${candidateId} because text3 is 'Herefish'.`
              );
              continue;
            }

            try {
              await updateRecord(candidateId, customObjectId, date1, date2);
            } catch (updateError) {
              console.error(
                `Error updating customObject ${customObjectId} for Candidate ${candidateId}:`,
                updateError.response?.data || updateError.message
              );
            }
          }
        } else {
          console.log(`Candidate ${candidateId} has no customObject1s data.`);
        }

        // After processing all customObject1s, update customText26 to "Yes"
        try {
          const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${BhRestToken}`;
          const payload = {
            customText26: "Yes",
          };
          await axios.post(url, payload, {
            headers: {
              "Content-Type": "application/json",
            },
          });
          console.log(
            `Updated customText26 to "Yes" for Candidate ${candidateId} after processing all customObject1s.`
          );
        } catch (updateError) {
          console.error(
            `Error updating customText26 for Candidate ${candidateId}:`,
            updateError.response?.data || updateError.message
          );
        }
      } catch (customObjectError) {
        console.error(
          `Error fetching customObject1s for Candidate ${candidateId}:`,
          customObjectError.message
        );
      }
    }
    console.log("All records updated successfully.");
  } catch (error) {
    console.error("Error updating records:", error.message);
  }
}

//Logging output to file
setupLogging();

// Run the main function 
swapDates();