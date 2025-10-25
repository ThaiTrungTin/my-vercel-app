/**
 * Phục vụ ứng dụng web
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Ứng dụng Quản lý Kho')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}
