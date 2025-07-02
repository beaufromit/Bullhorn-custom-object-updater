// Since dateAdded is what is used by automation to determine the date of a consent item (not date1 as previously thouht), we will need to copy the new value from date1 to the dateadded field.
// Future iterations of addLegitimateIneterest will need to be dated to set dateadded instead of date1.

require('dotenv').config();
const axios = require('axios');
const corpToken = process.env.CORP_TOKEN;
const {
  getAllRecords,
  getAllCustomObjects,
  confirmToContinue,
  setupGracefulStop,
  getBhRestToken,
  makeApiCall,
  buildLegitimateInterestCustomObjectQuery
} = require('./utils');
const pLimit = require('p-limit');
const limit = pLimit(5);
const getShouldStop = setupGracefulStop();


async function getAllCandidatesWithLegitimateInterestCO() {
  return await makeApiCall(async () => {
    const allRecords = [];
    let start = 0;
    const count = 200;
    const queryString = buildLegitimateInterestCustomObjectQuery();

    while (true) {
      console.log(`Fetching candidates for Legitimate Interest update starting from index ${start}...`);
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/search/Candidate?BhRestToken=${getBhRestToken()}&query=${queryString}&fields=id,customObject1s(id,date1,dateAdded,text2)&sort=id&start=${start}&count=${count}`;
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

async function updateCustomObjectDateAdded(candidateId, customObjectId, date1) {
  return await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
    const payload = {
      customObject1s: [{
        id: customObjectId,
        dateAdded: date1
      }]
    };
    await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`Updated dateAdded for customObject1 ${customObjectId} of Candidate ${candidateId} to ${date1}`);
  });
}

(async () => {
  try {
    console.log("Fetching all candidates...");
    const { allRecords } = await getAllCandidatesWithLegitimateInterestCO();
    console.log(`Found ${allRecords.length} candidates.`);

    await confirmToContinue();

    let processed = 0;
    let updated = 0;

    const tasks = allRecords.map(candidate => limit(async () => {
      if (getShouldStop()) return;
      processed++;
      const candidateId = candidate.id;
      console.log(`Processing candidate ${processed} of ${allRecords.length} (ID: ${candidateId})...`);

      const customObjects = await getAllCustomObjects(candidateId);
      if (!customObjects || !customObjects.length) return;

      for (const co of customObjects) {
        if (getShouldStop()) return;
        if (co.text2 && co.text2.trim().toLowerCase() === 'legitimate interest') {
          await updateCustomObjectDateAdded(candidateId, co.id, co.date1);
          updated++;
        }
      }
    }));

    await Promise.all(tasks);

        console.log(`Done. Candidates processed: ${processed}, Custom objects updated: ${updated}`);
  } catch (error) {
    console.error("Fatal error in updateLegitimateInterestDateAdded:", error.response?.data || error.message);
  }
})();