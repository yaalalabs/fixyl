const fs = require('fs');
const log = require('electron-log');
const path = require('path');

// Maximum log file size in bytes (e.g., 1MB)
const MAX_LOG_SIZE = 50 * 1024 * 1024;
// Maximum log file age in days
const MAX_LOG_AGE_DAYS = 5;

// Function to rotate log files
function rotateLogFile() {
  const logFilePath = log.transports.file.getFile().path;

  try {
    const stats = fs.statSync(logFilePath);
    if (stats.size > MAX_LOG_SIZE) {
      // Rename the current log file
      const rotatedLogFile = logFilePath.replace('.log', `-${Date.now()}.log`);
      fs.renameSync(logFilePath, rotatedLogFile);

      // Log rotation info
      log.info(`Log file rotated: ${rotatedLogFile}`);
    }
  } catch (err) {
    log.error('Error rotating log file:', err);
  }
}

// Function to delete log files older than MAX_LOG_AGE_DAYS
function deleteOldLogs() {
  const logDir = path.dirname(log.transports.file.getFile().path);
  const now = Date.now();
  const maxAgeMs = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000;

  try {
    // Ensure the log directory exists
    if (!fs.existsSync(logDir)) {
      log.warn(`Log directory does not exist: ${logDir}`);
      return;
    }

    // Read all files in the log directory
    const files = fs.readdirSync(logDir);

    files.forEach((file) => {
      const filePath = path.join(logDir, file);

      // Ignore the active log file
      if (file === path.basename(log.transports.file.getFile().path)) {
        return;
      }

      // Get file stats
      const stats = fs.statSync(filePath);

      // Check if the file is older than the threshold
      if (now - stats.mtimeMs > maxAgeMs) {
        // Delete the file
        fs.unlinkSync(filePath);
        log.info(`Deleted old log file: ${file}`);
      }
    });
  } catch (err) {
    log.error('Error deleting old log files:', err);
  }
}

// Schedule log rotation and cleanup
setInterval(rotateLogFile, 10 * 1000); // Check rotation every 10 seconds
setInterval(deleteOldLogs, 24 * 60 * 60 * 1000); // Run cleanup daily

// Run initial cleanup on startup
deleteOldLogs();