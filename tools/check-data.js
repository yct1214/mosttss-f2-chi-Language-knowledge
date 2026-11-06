// 檢查 data/extra.js 與 data/units.js 是否配合（干擾字、短文、情境題、名句錯字版本）
// 用法：node tools/check-data.js
// 檢查規則在 js/check.js，老師審訂模式的「自動檢查」也使用同一套規則。
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'data', 'units.js'));
require(path.join(__dirname, '..', 'data', 'extra.js'));
const checkData = require(path.join(__dirname, '..', 'js', 'check.js'));

const { problems, info } = checkData(window.UNITS, window.EXTRA);
info.forEach((line) => console.log(line));
problems.forEach((msg) => console.log('✗ ' + msg));
console.log(problems.length ? `共 ${problems.length} 個問題` : '✓ 全部檢查通過');
process.exitCode = problems.length ? 1 : 0;
