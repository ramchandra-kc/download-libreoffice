const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Command } = require('commander');
require('dotenv').config();
const { getStructuredJSON } = require('./parser');
const { askQuestion, downloadFile } = require('./downloader');

let open;
import('open').then((data) => {
    open = data.default;
}).catch((err) => {
    console.log('Error occured while importing open.', err)
});

const program = new Command();

program
    .requiredOption('-v, --version <version>', 'Version of LibreOffice Portable to download')
    .option('-f, --filepath <filepath>', 'Path to the file to open with LibreOffice');

program.parse(process.argv);

let { version, filepath } = program.opts();

if (!global.versionsFolder) {
    global.versionsFolder = process.env.SOFFICE_VERSIONS_PATH || __dirname;
}

if (!filepath) {
    filepath = process.env.FILE_PATH;
}

const extractFile = async (zipPath, dest) => {

    return new Promise((resolve, reject) => {

        exec(`7z x "${zipPath}" -y -o"${dest}"`, (error) => {
            if (error) {
                console.error(`Error running LibreOffice: ${error.message}`);
                reject(error);
                return;
            }
            resolve(true);

        });
    });
};

const getSofficeVersion = async function() {
    return new Promise((resolve, reject) => {

        exec(`soffice --version`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing soffice: ${error.message}`);
                resolve();
                return;
            }
        
            if (stderr) {
                console.error(`Error: ${stderr}`);
                resolve();
                return;
            }
            
            const versionMatch = stdout.match(/(\d+\.\d+\.\d+\.\d+)/);
    
            if (versionMatch) {
                let version = versionMatch[0];
                console.log(`Current installed LibreOffice version: ${version}`);
                version = stdout.split(' ').filter((e) => e.indexOf(version) === 0);
                if (version.length > 0) {
                    resolve(version[0]);
                }
            } else {
                console.error('Version number not found in the output');
                resolve();
            }

        });
    });
}

// need to extend this feature
const installLibreOffice = async (zipPath) => {
    if (open === undefined) {
        await global.sleep(1500);
    }
    open(zipPath, (error) => {
        if (error) {
            console.error(`Error running LibreOffice: ${error.message}`);
        }
    });
}

function openFileWithLibreOffice(executablePath, filepath) {
    const sofficeCmd = `"${executablePath}" "${filepath}"`;
    console.log('Running ', sofficeCmd);
    exec(sofficeCmd, (error) => {
        if (error) {
            console.error(`Error running LibreOffice: ${error.message}`);
        }
    });
}

const openLibreOfficePortable = (extractPath, filePath) => {
    let sofficeCmd;
    let executablePath;
    if (fs.existsSync(path.join(extractPath, 'LibreOfficePortable.exe'))) {
        executablePath = path.join(extractPath, 'LibreOfficePortable.exe')
    } else if (path.join(extractPath, 'LibreOfficePortablePrevious.exe')) {
        executablePath = path.join(extractPath, 'LibreOfficePortablePrevious.exe');
    } else {
        console.log('The LibreOffice Portable could not be found, please check if it exists in ', executablePath);
    }
    openFileWithLibreOffice(executablePath, filePath);
}

const runLibreOffice = (filePath) => {
    // const sofficeDotCom = path.join(extractPath, 'soffice.com');
    const sofficeCmd = `soffice.com ` + filePath;
    console.log('Running ', sofficeCmd);
    exec(sofficeCmd, (error) => {
        if (error) {
            console.error(`Error running LibreOffice: ${error.message}`);
        }
    });
};

const getDownloadURL = async (version) => {
    try {
        let [relevantVersions, versionsInfo] = await getStructuredJSON(version);

        let correctAnswer = false;
        let answer;
        if (relevantVersions.length === 0) {
            throw new Error('Version not found.')
        } else if (version.split('.').length === 4 && relevantVersions.length === 1) {
            answer = 1;
        } else {
            while (!correctAnswer) {
                answer = await askQuestion('Please select a version to download:\n' + relevantVersions.map((v, index) => (index + 1) + '. ' + v + `${versionsInfo[v].portable === undefined ? '' : ' (has portable)'}`).join('\n') + '\n');
                answer = Number(answer);
                if (!isNaN(answer) && answer > 0 && answer <= relevantVersions.length) {
                    correctAnswer = true;
                }
            }
        }
        let downloadUrl;
        let versionInfo = versionsInfo[relevantVersions[answer - 1]];
        if (versionInfo.portable) {
            for (let key in versionInfo.portable) {
                if (key.includes('Standard')) {
                    downloadUrl = versionInfo.portable[key];
                    break;
                }
                downloadUrl = versionInfo.portable[key];
            }
        } else {
            let loopIdx = 0;
            while ( typeof versionInfo === 'object' && loopIdx < 5) {
                loopIdx++;
                for (let key in versionInfo) {
                    versionInfo = versionInfo[key];
                    break;
                }
            }
            downloadUrl = versionInfo;
        }

        return { downloadURL: downloadUrl, selectedVersion: relevantVersions[answer - 1] };
    }
    catch (error) {
        throw new Error(`Version ${version} and subsequent versions not found`);
    }
}


(async () => {
    try {
        console.log('Retrieving the download url.');
        let { downloadURL, selectedVersion } = await getDownloadURL(version);
        let currentSofficeVersion = await getSofficeVersion();
        if (currentSofficeVersion === selectedVersion) {
            console.log('The soffice version is already installed.',)
            openFileWithLibreOffice('soffice', filepath);
            return;
        } 
        let versionDir = path.join(global.versionsFolder, selectedVersion);
        downloadedPath = path.join(global.versionsFolder, path.basename(downloadURL));
        if (fs.existsSync(versionDir)) {
            console.log(`Version ${selectedVersion} already exists. Skipping download and extraction.`);
        } else {
            if (fs.existsSync(downloadedPath)) {
                console.log('Version is already downloaded. Skipping downland.');
            } else {
                console.log(`Downloading LibreOffice${(downloadURL.includes('portable') ? ' Portable' : '')} version : ${selectedVersion}`);
                if (!fs.existsSync(downloadedPath)) {
                    try {
                        downloadedPath = await downloadFile(downloadURL, global.versionsFolder);
                    } catch (error) {
                        console.log('Error while downloading LibreOffice.', error)
                    }
                    console.log('Download complete.');
                }
            }
            if (downloadedPath.toLowerCase().includes('portable')) {
                console.log(`Extracting ...`);
                await extractFile(downloadedPath, versionDir);
                console.log('Extraction complete.');
            } else {

                // handle respectively for different os.
                // check if current downloaded version is expected one.

                await installLibreOffice(downloadedPath);
                return;
            }
        }
        if (filepath !== undefined) {
            if (fs.existsSync(filepath)) {
                console.log(`Opening file ${filepath} with LibreOffice Portable ...`);
                openLibreOfficePortable(versionDir, filepath);
            } else {
                console.log('Provided file path is invalid, please confirm if it exists.');
            }
        } else {
            console.log('You can find the version in ', downloadedPath);
        }
    } catch (error) {
        console.error(`Error: ${error}`);
    }
})();
