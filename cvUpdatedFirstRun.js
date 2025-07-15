// backfillCustomDate3FromFiles.js
require('dotenv').config();
const axios = require('axios');
const pLimit = require('p-limit');
const {
  makeApiCall,
  corpToken,
  getBhRestToken,
  getQueryConstants,
} = require('./utils');
const { setupLogging } = require('./logging');

setupLogging();

const limit = pLimit(5); // concurrency limit

// Optional: Accept query as parameter, or default to a standard one
const queryString = buildDefaultCandidateQuery();

function buildDefaultCandidateQuery() {
  const {
    recordIsNotDeleted,
    recordIsNotArchived,
    recordIsNotNewLead,
    noCvAddedDate,
    AND
  } = getQueryConstants();
  return `${recordIsNotDeleted}${AND}${recordIsNotArchived}${AND}${recordIsNotNewLead}${AND}${noCvAddedDate}`;
}

async function fetchAllCandidateIds(queryString) {
  const allCandidates = [];
  let start = 0;
  const count = 200;
  while (true) {
    // const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/search/Candidate?BhRestToken=${getBhRestToken()}&query=${queryString}&fields=id&start=${start}&count=${count}`;
    // console.log(`Fetching records starting from index ${start}...`);
    const response = await makeApiCall(async () => {
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/search/Candidate?BhRestToken=${getBhRestToken()}&query=${queryString}&fields=id&start=${start}&count=${count}`;
      console.log(`Fetching records starting from index ${start}...`);
      return axios.get(url);
    });
    const data = response.data.data;
    if (!data || data.length === 0) break;
    allCandidates.push(...data);
    start += data.length;
  }
  return allCandidates.map(candidate => candidate.id);
}

async function getMostRecentAttachmentDate(candidateId) {
  const response = await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}/fileAttachments?BhRestToken=${getBhRestToken()}&fields=id,dateAdded`;
    return axios.get(url);
  });
  const files = response.data.data || [];
  if (!files.length) return null;
  const latestFile = files.reduce((a, b) => (a.dateAdded > b.dateAdded ? a : b));
  return latestFile.dateAdded;
}

async function updateCustomDate3(candidateId, date) {
  const payload = { customDate3: date };
  await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
    await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`Updated Candidate ${candidateId} customDate3 to ${date}`);
  });
}


(async () => {
  console.log(`Fetching candidates with query: ${queryString}`);
  const candidateIds = await fetchAllCandidateIds(queryString);
  console.log(`Found ${candidateIds.length} candidates.`);

  const tasks = candidateIds.map(id => limit(async () => {
    const date = await getMostRecentAttachmentDate(id);
    if (!date) return;
    await updateCustomDate3(id, date);
  }));

  await Promise.all(tasks);
  console.log('Backfill completed.');
})();
