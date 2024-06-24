const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const baseURL = 'https://downloadarchive.documentfoundation.org/libreoffice/old/';
const relevantVersions = [];


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

global.getArch = function getArch() {
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

global.getOSType = function getOSType() {
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

async function getInitialLargePage(url) {
    // check if the html is downloaded and is done in the last 5 hours.
    let allVersionsInfoFile = path.join(process.env.SOFFICE_VERSIONS_PATH, 'allVersionsInfo.html');
    if (fs.existsSync(allVersionsInfoFile)) {
        const stats = fs.statSync(allVersionsInfoFile);
        const modificationTime = stats.mtime;
        const currentTime = new Date();
        const fiveHoursAgo = new Date(currentTime.getTime() - 5 * 60 * 60 * 1000);

        if (modificationTime >= fiveHoursAgo) {
            // file is there no need to download it again.
            let response = fs.readFileSync(allVersionsInfoFile, 'utf-8');
            return {data : response};
        }
    }
    // download the file.
    let response = await axios.get(url);
    fs.writeFileSync(allVersionsInfoFile, response.data);
    return response;
}

function isApplicationUrl(url) {
    if ((url.endsWith('tar.gz') || url.endsWith('.dmg') || url.endsWith('.exe') || url.endsWith('.msi')) && !url.includes('helppack') && !url.includes('sdk'))
        return true;
}

async function buildJSON(url, version, result) {
    // console.log('Downloading ', url);
    let response;
    if (url === baseURL) {
        response = await getInitialLargePage(url);
    } else {
        response = await axios.get(url);
    }
    // const response = await fetch(url);
    // const items = parseHTML(await response.text());

    const items = parseHTML(response.data);

    // console.log('Downloaded ', url);
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
    try {
        // get existing information
        let versionInfoPath = path.join(global.versionsFolder, 'versionInfo.json');
        let versionInfo = {};
        // console.log('Checking if it already exists.');
        if (fs.existsSync(versionInfoPath)) {
            versionInfo = JSON.parse(fs.readFileSync(versionInfoPath));
        }
        await buildJSON(baseURL, version, versionInfo);
        fs.writeFileSync(versionInfoPath, JSON.stringify(versionInfo, null, 2));
        return [relevantVersions, versionInfo];
    } catch (error) {
        console.log('Error occurred while retrieving the download url', error);
    }
}

module.exports = {
    getStructuredJSON: getURLs
}
// getURLs(baseURL, '6.2');