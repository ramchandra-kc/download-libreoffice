const axios = require('axios');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const ProgressBar = require('progress');

let clipboardy;
import('clipboardy').then((data) => {
    clipboardy = data.default;
});

let open;
import('open').then((data) => {
    open = data.default;
});

let default_dxm_Path = "C:/ProgramData/Microsoft/Windows/Start Menu/Programs/Xtreme Download Manager/Xtreme Download Manager.lnk"

// Function to download a file using axios
async function downloadUsingAxiosFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);

    try {
        const { data, headers } = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const totalLength = headers['content-length'];
        console.log('Starting download...');

        const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 1,
            total: parseInt(totalLength)
        });

        data.on('data', (chunk) => progressBar.tick(chunk.length));
        data.pipe(writer);

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

const downloadFile = async function (downloadUrl, outputPath) {
    return new Promise(async (resolve, reject) => {

        let downloadedFilePath = path.join(process.env.XDM_DOWNLOAD_PATH, path.basename(downloadUrl));
        if (fs.existsSync(downloadedFilePath)) {
            fs.copyFileSync(downloadedFilePath, path.join(outputPath, path.basename(downloadedFilePath)));
            // fs.rmSync(downloadedFilePath);
            resolve(path.join(outputPath, path.basename(downloadedFilePath)));
            return;
        }
        
        let xdmPath;
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
                        await downloadUsingAxiosFile(downloadUrl, downloadFilePath);
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