const keytar = require('keytar')
const APP_NAME = 'p8_fix_client'

module.exports.addToStore = async (name, username, password) => {
  try {
    const ret = await keytar.setPassword(
      `${APP_NAME}.${name}.credentials`,
      username,
      password,
    )

    return ret
  } catch (error) {
    return { error }
  }
}

module.exports.findInStore = async (name) => {
  try {
    const ret = await keytar.findCredentials(`${APP_NAME}.${name}.credentials`)
    return ret
  } catch (error) {
    return { error }
  }
}
