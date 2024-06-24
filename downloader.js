const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ProgressBar = require('progress');
const axios = require('axios');

let clipboardy;
import('clipboardy').then((data) => {
    clipboardy = data.default;
}).catch((err) => {
    console.log('Error occured while importing clipboardy.', err)
});

let open;
import('open').then((data) => {
    open = data.default;
}).catch((err) => {
    console.log('Error occured while importing open.', err)
});

let default_dxm_Path = "C:/ProgramData/Microsoft/Windows/Start Menu/Programs/Xtreme Download Manager/Xtreme Download Manager.lnk"

// Function to download a file using fetch api
async function downloadUsingFetchFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);

    try {
        // const response = await fetch(url);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const totalLength = response.headers.get('content-length');
        console.log('Starting download...');

        const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 1,
            total: parseInt(totalLength, 10)
        });

        // response.body.on('data', (chunk) => progressBar.tick(chunk.length));
        // response.body.pipe(writer);

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        writer.close();
        throw error;
    }
}

// Function to prompt user for yes or no input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

global.sleep = function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

const downloadFile = async function (downloadUrl, outputPath) {
    return new Promise(async (resolve, reject) => {
        let downloadedFilePath = path.join(process.env.XDM_DOWNLOAD_PATH, path.basename(downloadUrl));
        if (fs.existsSync(downloadedFilePath)) {
            fs.copyFileSync(downloadedFilePath, path.join(outputPath, path.basename(downloadedFilePath)));
            fs.rmSync(downloadedFilePath);
            resolve(path.join(outputPath, path.basename(downloadedFilePath)));
            return;
        }

        let xdmPath;
        if (clipboardy === undefined || open === undefined)
            await sleep(1500);
        // Copy the string to the clipboard
        clipboardy.writeSync(downloadUrl);
        console.log("Download URL copied to clipboard!");
        if (!fs.existsSync(process.env.XDM_PATH)) {
            console.log('XDM could not be found, trying the default location.');
            if (!fs.existsSync(default_dxm_Path)) {
                console.log('XDM could not be found in default location. Please install xdm to download faster.');
                try {
                    const answer = await askQuestion('Do you want to download the file in normal way? (y/n) ');

                    if (answer.toLowerCase() === 'y') {
                        let downloadFilePath = path.join(outputPath, path.basename(downloadUrl));
                        await downloadUsingFetchFile(downloadUrl, downloadFilePath);
                        console.log('File downloaded successfully!');
                        resolve(downloadFilePath);
                        return;
                    } else {
                        console.log('Download cancelled.');
                        reject('Download cancelled.');
                        return;
                    }
                } catch (err) {
                    console.error('Failed to download file:', err);
                    reject(err);
                    return;
                }

            } else {
                xdmPath = default_dxm_Path;
            }
        } else {
            xdmPath = process.env.XDM_PATH;
        }

        if (xdmPath) {
            open(xdmPath).then(() => {
                console.log("Opening XDM, Please click plus(+) and Download.");
                let intervalId;
                function checkIfDownloaded() {
                    // start moving
                    if (fs.existsSync(downloadedFilePath)) {
                        if (intervalId !== undefined)
                            clearInterval(intervalId);
                        fs.copyFileSync(downloadedFilePath, path.join(outputPath, path.basename(downloadedFilePath)));
                        // fs.rmSync(downloadedFilePath);
                        resolve(path.join(outputPath, path.basename(downloadedFilePath)));
                        return;
                    }
                }
                checkIfDownloaded();
                intervalId = setInterval(checkIfDownloaded, 2000);

            }).catch(err => {
                console.error("Failed to open XDM:", err);
                reject(false);
                return;
            });
        }
    });
};

module.exports = {
    downloadFile: downloadFile,
    askQuestion: askQuestion
}