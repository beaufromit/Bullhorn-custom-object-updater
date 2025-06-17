require('dotenv').config();
const axios = require('axios');
const { makeApiCall, getAllCandidatesForCVUpdate, getAllFileAttachments, corpToken, getBhRestToken } = require('./utils');

// Update candidate's customDate2
async function updateCandidateCustomDate2(candidateId, dateValue) {
  await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
    const payload = { customDate2: dateValue };
    await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`Updated Candidate ${candidateId} customDate2 to ${dateValue}`);
  });
}

(async () => {
  const candidates = await getAllCandidatesForCVUpdate();
  console.log(`Fetched ${candidates.length} candidates.`);

  for (const candidate of candidates) {
    const candidateId = candidate.id;
    const candidateCustomDate2 = candidate.customDate2 ? Number(candidate.customDate2) : 0;

    const files = await getAllFileAttachments(candidateId);
    const validFiles = files
      .filter(file => file.dateAdded && !isNaN(Number(file.dateAdded)))
      .map(file => ({ ...file, dateAdded: Number(file.dateAdded) }));

    if (validFiles.length === 0) {
      console.log(`No files for candidate ${candidateId}, skipping.`);
      continue;
    }

    validFiles.sort((a, b) => b.dateAdded - a.dateAdded);
    const mostRecent = validFiles[0];

    if (mostRecent.dateAdded > candidateCustomDate2) {
      await updateCandidateCustomDate2(candidateId, mostRecent.dateAdded);
    } else {
      console.log(`Candidate ${candidateId} already up to date.`);
    }
  }
})();