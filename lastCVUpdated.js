require('dotenv').config();
const axios = require('axios');
const {
    makeApiCall, 
    corpToken, 
    getBhRestToken 
} = require('./utils');
const { logCandidateUpdate } = require('./logging');

// Helper: Update candidate's customDate3 field
async function updateCandidateCustomDate3(candidateId, dateValue) {
  await makeApiCall(async () => {
    const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/entity/Candidate/${candidateId}?BhRestToken=${getBhRestToken()}`;
    const payload = { customDate3: dateValue };
    await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    logCandidateUpdate(`Updated Candidate ${candidateId} customDate3 to ${dateValue}`);
  });
}

// Main polling function
async function pollCandidateEvents() {
  try {
    await makeApiCall(async () => {
      // Fetch up to 100 events from the CandidateFileAlert subscription
      const url = `https://rest21.bullhornstaffing.com/rest-services/${corpToken}/event/subscription/CandidateFileAlert?BhRestToken=${getBhRestToken()}&maxEvents=100`;
      const response = await axios.get(url);
      const events = response.data.events || [];
      console.log(`Fetched ${events.length} events from 'CandidateFileAlert'.`);

      // Filter for Candidate UPDATED events where description changed
      const relevantEvents = events.filter(event =>
      event.entityName === 'Candidate' &&
      event.entityEventType === 'UPDATED' &&
      event.updatedProperties &&
      (event.updatedProperties.includes('description') || event.updatedProperties.includes('parsedResumeFile'))
    );

      if (relevantEvents.length === 0) {
        console.log("No candidate description updates or new candidates found in this poll.");
      }

      // Process each relevant event
      for (const event of relevantEvents) {
        const candidateId = event.entityId;
        const timestamp = event.eventTimestamp;
        if (candidateId && timestamp) {
          await updateCandidateCustomDate3(candidateId, timestamp);
        }
      }
    });
  } catch (err) {
    console.error("Error polling events:", err);
  }
}

// Start polling every 1 minute
pollCandidateEvents();  // initial run immediately
setInterval(pollCandidateEvents, 10000); //check for updates every 10 seconds