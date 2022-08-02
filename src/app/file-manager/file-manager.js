const fs = require("fs");
const util = require("util");
const { dialog } = require("electron");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

module.exports = class FileManager {
  static readFile = async (path) => {
    try {
      const { mtime, size } = fs.statSync(path);
      const data = await readFile(path, "utf-8");
      const response = {
        fileData: {
          data,
          lastUpdatedTime: mtime.toString(),
          size,
        },
      };

      return response;
    } catch (error) {
      return { error };
    }
  };

  static writeFile = async (path, data) => {
    try {
      await writeFile(path, data);
      return { status: true };
    } catch (error) {
      return { error };
    }
  };

  static deleteFile = async (path) => {
    try {
      await unlink(path);
      return { status: true };
    } catch (error) {
      return { error };
    }
  };

  static selectFile = async (properties) => {
    return new Promise((resolve) => {
      dialog.showOpenDialog({ properties }).then((response) => {
        if (!response.canceled) {
          resolve({ path: response.filePaths[0] });
        } else {
          resolve({ path: undefined });
        }
      });
    });
  };

  static hasFile(path) {
    return { status: fs.existsSync(path) };
  }

  static mkdir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  static listFiles(dir) {
    let files = undefined;
    
    if (fs.existsSync(dir)) {
      try {
        files = fs.readdirSync(dir);
      } catch (err) {
        return { error };
      }
    }

    return {
      files,
    };
  }
};
