# Introduction

The script will download the specific version of libreoffice.  
This is useful when you want to test something with different versions of libreoffice.

I have tested this with windows only and need to confirm this with Mac and Linux.

## Aim to fix

- Searching for specific version of Libre Office based of your OS and Arch type
- Download fast
- Open the file with specific version of soffice with command.

## Please have `.env` file

- XDM_PATH              // path of fast download manager executable.
- XDM_DOWNLOAD_PATH     // place where the download manager downlands the file.    
- SOFFICE_VERSIONS_PATH // place to download multiple versions of LibreOffice.

## Prerequisites  

### Xtreme Download Manager

Used to download the LibreOffice. https://xtremedownloadmanager.com/

XDM does not have CLI, so you need to intervene to make it work.

Download from the website or install with  

```bash
choco install xdm
```

### 7zip

This is used to extract the portable soffice version. Download from https://www.7-zip.org/download.html or  
install with choco  

```bash
choco install 7zip.install
```

When we try to download the older versions of libreoffice, we need to find the specific version based on your os, arch and so on.
This has been 

## Implementation

First a request is made to https://downloadarchive.documentfoundation.org/libreoffice/old/ and looked for a specific version of soffice, if multiple versions matches with provided version then all are shown as available versions with option to choose the specific version to download.

The link for the selected version based on you os and arch type is selected then, download link is copied to your clipboard.

The selected downloader is opened and you can download the file.
Once it has been downloaded, (for portable it is extracted to provided value in env variable `SOFFICE_VERSIONS_PATH`, if not you will have to install it.)

If a file is provided with -f , then the particular file will be opened with the respective version.

## Usage
index [options]
ex (`node index.js -v 6.4.6 -f 'filepath'`)

Options:
  -v, --version <version>    Version of LibreOffice Portable to download
  -f, --filepath <filepath>  Path to the file to open with LibreOffice
  -h, --help                 display help for command
