const { execSync } = require('child_process');
const path = require('path');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outFile = path.join(__dirname, '../preview.png');
execSync(`"${chromePath}" --headless=new --disable-gpu --window-size=950,2600 --screenshot="${outFile}" "http://localhost:5500/test_quotation_print.html"`, { stdio: 'inherit' });
console.log('Screenshot saved to:', outFile);
