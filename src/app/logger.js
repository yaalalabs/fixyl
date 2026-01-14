const log = require('electron-log');

const originalConsoleLog = console.log;

// Override console.log
console.log = function (...args) {
  const timestamp = new Date().toISOString();
  try {
    const message = `[${timestamp}] ${args.join(' ')}`;    
    log.debug(message);
  } catch(err) {
    
  }

  originalConsoleLog(`[${timestamp}] `, ...args);
};


// Override console.log
const originalConsoleWarn = console.warn;
console.warn = function (...args) {
  const timestamp = new Date().toISOString();
  try {
    const message = `[${timestamp}] ${args.join(' ')}`; 
    log.warn(message);
  } catch(err) {
    
  }
  originalConsoleWarn(`[${timestamp}] `, ...args);
};

// Override console.log
const originalConsoleInfo = console.info;
console.info = function (...args) {
  const timestamp = new Date().toISOString();
  try {
    const message = `[${timestamp}] ${args.join(' ')}`;  
    log.info(message);
  } catch(err) {
    
  }
  originalConsoleInfo(`[${timestamp}] `, ...args);
};

// Override console.log
const originalConsoleError = console.error;
console.error = function (...args) {
  const timestamp = new Date().toISOString();
  try {
    const message = `[${timestamp}] ${args.join(' ')}`;
    log.error(message);
  } catch(err) {
    
  }
  originalConsoleError(`[${timestamp}] `, ...args);
};
