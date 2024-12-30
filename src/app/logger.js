const log = require('electron-log');

// Override console.log
console.log = function (...args) {
  const timestamp = new Date().toISOString();
  try {

  } catch(err) {
    
  }
  const message = `[${timestamp}] ${args.join(' ')}`;
  
  log.debug(message);

//   originalConsoleLog(`[${timestamp}] `, ...args);
};

// Override console.log
console.warn = function (...args) {
  const timestamp = new Date().toISOString();
  try {

  } catch(err) {
    
  }
  const message = `[${timestamp}] ${args.join(' ')}`;
  
  log.warn(message);

};

// Override console.log
console.info = function (...args) {
  const timestamp = new Date().toISOString();
  try {

  } catch(err) {
    
  }
  const message = `[${timestamp}] ${args.join(' ')}`;
  
  log.info(message);
};

// Override console.log
console.error = function (...args) {
  const timestamp = new Date().toISOString();
  try {

  } catch(err) {
    
  }
  const message = `[${timestamp}] ${args.join(' ')}`;
  
  log.error(message);
};
