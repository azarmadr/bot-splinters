async function login(page) {
  try {
    page.waitForSelector('#log_in_button > button').then(() => page.click('#log_in_button > button'))
    await page.waitForSelector('#email')
      .then(() => page.waitForTimeout(3000))
      .then(() => page.focus('#email'))
      .then(() => page.type('#email', process.env.ACCOUNT))
      .then(() => page.focus('#password'))
      .then(() => page.type('#password', process.env.PASSWORD))

    // .then(() => page.waitForSelector('#login_dialog_v2 > div > div > div.modal-body > div > div > form > div > div.col-sm-offset-1 > button', { visible: true }).then(() => page.click('#login_dialog_v2 > div > div > div.modal-body > div > div > form > div > div.col-sm-offset-1 > button')))
      .then(() => page.keyboard.press('Enter'))
      .then(() => page.waitForTimeout(5000))
      .then(() => page.reload())
      .then(() => page.waitForTimeout(3000))

  } catch (e) {
    console.log('login error', e);
  }
}

module.exports = {
  login
}
