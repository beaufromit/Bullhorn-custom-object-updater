//This script will add a legitimate interest item to all candidate records that are missing one. It will set the date recieved to the candidate date added.

require('dotenv').config();
const {
  makeApiCall,
  buildLegitimateInterestQueryString,
  getAllCustomObjects,
  corpToken,
  getBhRestToken,
  confirmToContinue,
  getQueryConstants,
  setupGracefulStop
} = require('./utils');
const { setupLogging } = require('./logging');
const axios = require('axios');
const getShouldStop = setupGracefulStop();
const chalk = require('chalk').default;
const pLimit = require('p-limit');
const limit = pLimit(5);

// Custom getAllRecords for this script
async function getAllCandidatesForLegitimateInterest() {
  return await makeApiCall(async () => {
    const allRecords = [];
    let start = 0;
    const count = 200;
    const queryString = buildLegitimateInterestQueryString();

    while (true) {
      console.log(`Fetching candidates for Legitimate Interest starting from index ${start}...`);
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/search/Candidate?BhRestToken=${getBhRestToken()}&query=${queryString}&fields=id,dateAdded,customObject1s(id,date1,date2,text2,text3)&sort=id&start=${start}&count=${count}`;
      const response = await axios.get(url);
      const records = response.data.data;

      if (start === 0) {
        total = response.data.total;
      }

      if (records && records.length > 0) {
        allRecords.push(...records);
        start += records.length;
      } else {
        break;
      }
    }

    return { total, allRecords };
  });
}

// Function to find all candidates missing a customObject1s with text2 === 'Legitimate Interest'
async function findCandidatesMissingLegitimateInterest(allRecords) {
  // const { allRecords } = await getAllCandidatesForLegitimateInterest();
  const candidatesMissing = [];

  let processedCount = 0;
   const tasks = allRecords.map(candidate => limit(async () => {
    processedCount++;
    console.log(`Checking candidate ${processedCount} of ${allRecords.length} (ID: ${candidate.id})...`);

    const customObjects = await getAllCustomObjects(candidate.id); // Fetch all customObject1s for this candidate

    let hasLegitInterest = false;
    if (customObjects && customObjects.length > 0) {
      for (const customObject of customObjects) {
        const { text2 } = customObject;
        if (text2 && text2.trim().toLowerCase() === 'legitimate interest') {
          hasLegitInterest = true;
          break;
        }
      }
    }

    if (!hasLegitInterest) {
      candidatesMissing.push({
        id: candidate.id,
        dateAdded: candidate.dateAdded,
      });
      console.log(`Candidate ${candidate.id} is missing 'Legitimate Interest' customObject1s.`);
    }
  }));

  await Promise.all(tasks);

  return candidatesMissing;
}

async function addLegitimateInterestCustomObject(candidateId, candidateDateAdded) {
  return await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
    const payload = {
      customObject1s: [{
        text1: 'Recruitment',
        text2: 'Legitimate Interest',
        date1: candidateDateAdded,
        text3: 'Herefish',
        textBlock1: 'Added by API'
      }]
    };
    await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(chalk.green(`Added Legitimate Interest customObject1s for Candidate ${candidateId}.`));
  });
}

(async () => {
  try {
    setupLogging();
    console.log("Starting Legitimate Interest check...");

    // 1. Show constants and query
    console.log("Constants used in the 'get all candidates' query:");
    console.log(getQueryConstants());

    const queryString = buildLegitimateInterestQueryString();
    console.log("Full query string being used:");
    console.log(queryString);

    // 2. Fetch candidates
    const { allRecords } = await getAllCandidatesForLegitimateInterest();
    console.log(`Total number of candidates found: ${allRecords.length}`);

    // 3. Prompt for confirmation
    await confirmToContinue();

    // 4. Find missing and process
    const missing = await findCandidatesMissingLegitimateInterest(allRecords);
    console.log(`Found ${missing.length} candidates missing 'Legitimate Interest' customObject1s.`);

    let processed = 0;
    let successCount = 0;
    let failCount = 0;
    const tasks = missing.map(candidate => limit(async () => {
      if (getShouldStop()) {
        return;
      }
      processed++;
      console.log(`Adding customObject1s for candidate ${candidate.id} (${processed} of ${missing.length})...`);
      try {
        await addLegitimateInterestCustomObject(candidate.id, candidate.dateAdded);
        successCount++;
      } catch (error) {
        console.error(`Failed to add customObject1s for candidate ${candidate.id}:`, error.response?.data || error.message);
        failCount++;
      }
    }));

    await Promise.all(tasks);

    console.log(`${processed} missing candidates processed. Success: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error("Fatal error in addLegitimateInterest:", error.response?.data || error.message);
  }    
})();