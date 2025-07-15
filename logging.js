const fs = require('fs');
const path = require('path');

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

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}


// Create a write stream for candidate updates log
const candidateUpdateLogPath = path.join(logsDir, 'candidateUpdated.log');
const candidateLogStream = fs.createWriteStream(candidateUpdateLogPath, { flags: 'a' });  // append mode

// New function to log candidate customDate3 updates
function logCandidateUpdate(...args) {
  const timestamp = `[${getTimestampForLog()}]`;
  // Combine all arguments into one message string (similar to console.log formatting)
  const message = args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
  // Write the timestamped message to the candidate updates log file
  candidateLogStream.write(`${timestamp} ${message}\n`);
  console.log(timestamp, ...args);
}

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
module.exports = { 
  setupLogging,
  logCandidateUpdate,
};