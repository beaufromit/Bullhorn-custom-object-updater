// This script is designed to interact with the Bullhorn API to update custom objects for candidates. It swaps the date1 and date2 fields of customObject1s for candidates that are not marked as 'Herefish' in the text3 field. The script handles token renewal and error logging.

require('dotenv').config(); // Load environment variables from .env file
const {
  makeApiCall,
  getQueryConstants,
  buildQueryString,
  getAllRecords,
  getAllCustomObjects,
  corpToken,
  getBhRestToken,
  confirmToContinue,
  setupGracefulStop
} = require('./utils');
const { setupLogging } = require('./logging.mjs');
const axios = require('axios');
const getShouldStop = setupGracefulStop();

// Function to update a record 
async function updateRecord(candidateId, customObjectId, date1, date2) {
  return await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
    const payload = {
      "customObject1s":[{
      "id": customObjectId,
      "date1": date2, 
      "date2": date1
      }],
      "customText26": "Processing" // Mark the candidate as processed
    }; 

    await axios.post(url, payload, {
      headers: {  
        'Content-Type': 'application/json'        }
    });
    console.log(`Successfully updated CustomObject ${customObjectId} for Candidate ${candidateId}. Payload: `, payload);
  }); 
}

//Function to coordinate getAllRecords, getAllCustomObjects and updateRecord
async function swapDates() {
  try {
    const { allRecords } = await getAllRecords();
    console.log(`Processing ${allRecords.length} candidates...`);

    let processedCount = 0; // Initialize the progress counter

    for (const record of allRecords) {
      if (getShouldStop()) {
        console.log('Stopping script after finishing the current record.');
        break; // Exit the loop if the stop flag is set
      }

      processedCount++; // Increment the counter for each candidate
      console.log(`Processing candidate ${processedCount} of ${allRecords.length}...`);

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

            await updateRecord(candidateId, customObjectId, date1, date2);
          }
        } else {
          console.log(`Candidate ${candidateId} has no customObject1s data.`);
        }

        // After processing all customObject1s, update customText26 to "Yes"
        const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
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
      } catch (error) {
        console.error(
          `Error processing Candidate ${candidateId}:`,
          error.response?.data || error.message
        );
      }
    }

    console.log("All records updated successfully.");
  } catch (error) {
    console.error("Error updating records:", error.response?.data || error.message);
  }
}

// Main script
(async () => {
  console.log("Constants used in the 'get all candidates' query:");
  console.log(getQueryConstants());

  // Construct the full query string dynamically
  const queryString = buildQueryString();
  const fullQuery = `${queryString}`;

  console.log("Full query string being used:");
  console.log(fullQuery);

   // Fetch total count of candidates
  const { total } = await getAllRecords();
  console.log(`Total number of candidates found: ${total}`);

  // Wait for user confirmation
  await confirmToContinue();

  // Logging output to file
  setupLogging();

  // Run the main function
  swapDates();
})();