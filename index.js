const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Command } = require('commander');
require('dotenv').config();
const { getStructuredJSON } = require('./parser');
const { askQuestion, downloadFile } = require('./downloader');

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

// need to extend this feature
const installLibreOffice = async (zipPath) => {
    exec(zipPath, (error) => {
        if (error) {
            console.error(`Error running LibreOffice: ${error.message}`);
        }
    });
}

const openLibreOfficePortable = (extractPath, filePath) => {
    let sofficeCmd;
    let executablePath = path.join(extractPath, 'LibreOfficePortable.exe');
    if (fs.existsSync(executablePath)) {
        sofficeCmd = `"${executablePath}" "${filePath}"`;
        console.log('Running ', sofficeCmd);
        exec(sofficeCmd, (error) => {
            if (error) {
                console.error(`Error running LibreOffice: ${error.message}`);
            }
        });
    } else {
        console.log('The LibreOffice Executable could not be found, please check if it exists in ', executablePath );
    }
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
            while (Object.keys(versionInfo).length > 0 && loopIdx < 5) {
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
        let versionDir = path.join(global.versionsFolder, selectedVersion);
        downloadedPath = path.join(versionDir, path.basename(downloadURL));
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
                // await installLibreOffice(downloadedPath);
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
