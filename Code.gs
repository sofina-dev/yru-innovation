/**
 * Single entry point. No `page=` branching — the whole app is one HTML
 * template and one client-side router, which is what makes navigation
 * instant instead of a full server round trip per screen.
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.publicDataJson = JSON.stringify(normalizeForJson_(buildPublicData_()));
  template.appUrl = getAppUrl_();

  return template.evaluate()
    .setTitle('YRU Innovation Portal')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppUrl_() {
  return ScriptApp.getService().getUrl() || '';
}
