const fs = require('fs');

// Function to get the current timestamp for filenames
const getTimestampForFilename = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-'); // Replace invalid filename characters
};

// Function to get the current timestamp for log entries
const getTimestampForLog = () => {
  return new Date().toISOString(); // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
};

// Create log file names with the timestamp
const timestampForFilename = getTimestampForFilename();
const logFileName = `script-${timestampForFilename}.log`;
const errorFileName = `script-errors-${timestampForFilename}.log`;

// Create writable streams for the log files
const logFile = fs.createWriteStream(logFileName, { flags: 'a' }); // Append mode
const errorFile = fs.createWriteStream(errorFileName, { flags: 'a' }); // Separate error log (optional)

// Define the setupLogging function
const setupLogging = () => {
  const originalLog = console.log;
  console.log = (...args) => {
    const timestamp = `[${getTimestampForLog()}]`;
    originalLog(timestamp, ...args); // Output to the console
    logFile.write(timestamp + ' ' + args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ') + '\n');
  };

  const originalError = console.error;
  console.error = (...args) => {
    const timestamp = `[${getTimestampForLog()}]`;
    originalError(timestamp, ...args); // Output to the console
    errorFile.write(timestamp + ' ' + args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ') + '\n');
  };
};

// Export the setupLogging function
module.exports = { setupLogging };