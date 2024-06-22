const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const os = require('os');
const baseURL = 'https://downloadarchive.documentfoundation.org/libreoffice/old/';
const relevantVersions = [];
async function fetchHTML(url) {
    const { data } = await axios.get(url);
    return data;
}

function parseHTML(html) {
    const $ = cheerio.load(html);
    const items = [];

    $('a').each((index, element) => {
        const name = $(element).text();
        const href = $(element).attr('href');

        // Skip parent directory link
        if (href === '../') {
            return;
        }

        items.push({
            name: name.endsWith('/') ? name.slice(0, -1) : name,
            href
        });
    });

    return items;
}

global.getArch =  function getArch() {
    switch (os.arch()) {
        case 'aarch64':
            archType = 'aarch64';
            break;
        case 'x32':
        case 'ia32':
            archType = 'x86';
            break;
        case 'x64':
            archType = 'x86_64';
            break;
        default:
            archType = false;
            break;
    }
    return archType;
}

global.getOSType =  function getOSType() {
    switch (os.type()) {
        case 'Darwin':
            osType = 'mac';
            break;
        case 'Windows_NT':
            osType = 'win';
            break;
        case 'Linux':
            osType = 'deb';
            break;
        default:
            osType = false;
            break;
    }
    return osType;
}

function usefulUrl(url, version) {
    // version
    let lastPath = path.basename(url);
    if (lastPath.split('.').every((a) => !isNaN(Number(a)) || /alpha|beta|hotfix/.test(a))) {
        if (lastPath.indexOf(version) === 0) {
            return 'version';
        } else if (compareVersions(lastPath, version) === 1) {
            return 'end';
        }
        return false;
    } else if (lastPath === getOSType() || lastPath == getArch() || (getOSType() === 'win' && lastPath === 'portable'))
        return true;
}

function compareVersions(version1, version2) {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);

    const maxLength = Math.max(v1.length, v2.length);

    for (let i = 0; i < maxLength; i++) {
        const num1 = v1[i] || 0; // If component is missing, treat it as 0
        const num2 = v2[i] || 0;

        if (num1 > num2) {
            return 1;
        }
        if (num1 < num2) {
            return -1;
        }
    }
    return 0;
}


function isApplicationUrl(url) {
    if ((url.endsWith('tar.gz') || url.endsWith('.dmg') || url.endsWith('.exe') || url.endsWith('.msi')) && !url.includes('helppack') && !url.includes('sdk'))
        return true;
}

async function buildJSON(url, version, result) {
    const html = await fetchHTML(url);
    const items = parseHTML(html);
    result = result || {};

    for (const item of items) {
        let newUrl = url + item.href
        if (item.href.endsWith('/') && !item.href.startsWith('http') && item.name !== 'Parent Directory') {
            let isUsefulUrl = usefulUrl(newUrl, version);
            if (isUsefulUrl) {
                try {
                    if (isUsefulUrl === 'end') {
                        // console.log(JSON.stringify(result, null, 2));
                        return result;
                    }
                    if (result[item.name] === undefined) {
                        result[item.name] = await buildJSON(newUrl, version);
                        if (isUsefulUrl === 'version')
                            console.log('Completed for version :', item.name)
                    }
                    if (isUsefulUrl === 'version')
                        relevantVersions.push(item.name);
                } catch (err) {

                }
            }
        } else if (isApplicationUrl(newUrl)) {
            result[item.name] = newUrl;
        }
    }

    return result;
}


async function getURLs(version) {
    // get existing information
    let versionInfoPath = path.join(global.versionsFolder, 'versionInfo.json');
    let versionInfo = {};
    if (fs.existsSync(versionInfoPath)) {
        versionInfo = JSON.parse(fs.readFileSync(versionInfoPath));
    }
    await buildJSON(baseURL, version, versionInfo);
    fs.writeFileSync(versionInfoPath, JSON.stringify(versionInfo, null, 2));
    return [relevantVersions, versionInfo];
}

module.exports = {
    getStructuredJSON: getURLs
}
// getURLs(baseURL, '6.2');