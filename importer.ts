// Load environment variables from .env file
import 'dotenv/config';

import {
    importDirectorySync,
    cleanupSVG,
    runSVGO,
    parseColors,
    isEmptyColor,
} from '@iconify/tools';

import { ListObjectsV2Command, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

// Config
const config = {
    bucketName: process.env.S3_BUCKET_NAME || 'lgtd-icons',
    region: process.env.S3_REGION || "fr-par",
    endpoint: process.env.S3_ENDPOINT || "https://s3.fr-par.scw.cloud",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    }
}

// Configure S3 client
const s3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.credentials.accessKeyId,
      secretAccessKey: config.credentials.secretAccessKey,
    },
});

// S3 bucket configuration
const tempDir = './temp';
const outputDir = './icons';

// Create temp and output directories if they don't exist
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Function to list all top-level directories in the S3 bucket
async function listS3Directories() {
    try {
        const command = new ListObjectsV2Command({
            Bucket: config.bucketName,
            Delimiter: '/',
        });

        const response = await s3Client.send(command);

        // Extract directory prefixes (common prefixes)
        const directories = response.CommonPrefixes?.map(prefix => {
            return prefix.Prefix ? prefix.Prefix.replace(/\/$/, '') : '';
        }).filter(prefix => prefix !== '') || [];
        return directories;
    } catch (error) {
        console.error('Error listing S3 directories:', error);
        return [];
    }
}

// Define result type for better type safety
type ProcessResult = {
    directory: string;
    iconCount: number;
    error?: string;
};

// Function to download and process a directory
async function processDirectory(directoryPrefix: string): Promise<ProcessResult> {
    try {
        // Create local directory for this prefix
        const localDirName = path.basename(directoryPrefix);
        const localDirPath = path.join(tempDir, localDirName);
        const svgDirPath = path.join(outputDir, 'svg', localDirName);

        if (!fs.existsSync(localDirPath)) {
            fs.mkdirSync(localDirPath, { recursive: true });
        }
        if (!fs.existsSync(svgDirPath)) {
            fs.mkdirSync(svgDirPath, { recursive: true });
        }

        // List objects in this directory
        const command = new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: `${directoryPrefix}/`,
        });

        const response = await s3Client.send(command);

        // Download each file
        if (response.Contents) {
            for (const object of response.Contents) {
                if (object.Key && object.Key.endsWith('.svg')) {
                    const fileName = path.basename(object.Key);
                    const localFilePath = path.join(localDirPath, fileName);
                    const svgFilePath = path.join(svgDirPath, fileName);

                    // Get the object from S3
                    let success = false;
                    let retries = 3;

                    while (retries > 0 && !success) {
                        try {
                            const getObjectCommand = new GetObjectCommand({
                                Bucket: config.bucketName,
                                Key: object.Key,
                            });

                            const { Body } = await s3Client.send(getObjectCommand);

                            if (Body instanceof Readable) {
                                // Save the file locally
                                const writeStream = fs.createWriteStream(localFilePath);
                                await finished(Body.pipe(writeStream));

                                // Copy to SVG directory for processing
                                fs.copyFileSync(localFilePath, svgFilePath);
                            }

                            success = true;
                        } catch (error) {
                            console.error(`Failed to download file: ${error}`);
                            retries--;
                        }
                    }

                    if (!success) {
                        console.error(`Failed to download file: ${object.Key}`);
                    }
                }
            }
        }

        // Process the downloaded directory
        console.log(`Processing directory: ${localDirName}`);
        const iconSet = importDirectorySync(svgDirPath, {
            prefix: localDirName,
        });

        // Validate, clean up, fix palette and optimise
        iconSet.forEachSync((name, type) => {
            if (type !== 'icon') {
                return;
            }

            const svg = iconSet.toSVG(name);
            if (!svg) {
                // Invalid icon
                iconSet.remove(name);
                return;
            }

            // Clean up and optimise icons
            try {
                // Clean up icon code
                cleanupSVG(svg);

                // Assume icon is monotone: replace color with currentColor, add if missing
                // If icon is not monotone, remove this code
                parseColors(svg, {
                    defaultColor: 'currentColor',
                    callback: (attr, colorStr, color) => {
                        return !color || isEmptyColor(color)
                            ? colorStr
                            : 'currentColor';
                    },
                });

                // Optimise
                runSVGO(svg);
            } catch (err) {
                // Invalid icon
                console.error(`Error parsing ${name}:`, err);
                iconSet.remove(name);
                return;
            }

            // Update icon
            iconSet.fromSVG(name, svg);
        });

        // Export
        const exportData = iconSet.export();
        console.log(`Exported ${Object.keys(exportData.icons || {}).length} icons from ${localDirName}`);

        // Set infos 
        exportData.info = {
            name: localDirName,
            author: {
                name: 'Logitud',
                url: 'https://logitud.fr',
            },
            license: {
                title: 'MIT',
                spdx: 'MIT',
                url: 'https://github.com/logitud/lgtd-icons/blob/main/LICENSE.md',
            }
        };

        // Save the exported data to a JSON file
        const exportPath = path.join(outputDir, `${localDirName}.json`);
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

        return {
            directory: localDirName,
            iconCount: Object.keys(exportData.icons || {}).length
        };
    } catch (error: any) {
        console.error(`Error processing directory ${directoryPrefix}:`, error);

        return {
            directory: directoryPrefix,
            iconCount: 0,
            error: error.message || String(error)
        };
    }
}

async function minifyJsonFiles() {
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
        if (file.endsWith('.json')) {
            const filePath = path.join(outputDir, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            fs.writeFileSync(filePath, JSON.stringify(data));
        }
    }
}

// Main function to process all directories
async function main() {
    if (!config.credentials.accessKeyId || !config.credentials.secretAccessKey) {
        console.error('Missing S3 credentials');
        return;
    }

    try {
        // List all directories in the bucket
        const directories = await listS3Directories();
        console.log(`Found ${directories.length} directories in bucket ${config.bucketName}`);

        // Process each directory
        const promises = directories.map(directory => {
            console.log(`Starting to process directory: ${directory}`);
            return processDirectory(directory);
        });
        const results: ProcessResult[] = await Promise.all(promises);

        // Output summary
        console.log('\nProcessing Summary:');
        results.forEach(result => {
            if (result.error) {
                console.log(`- ${result.directory}: Failed - ${result.error}`);
            } else {
                console.log(`- ${result.directory}: Processed ${result.iconCount} icons`);
            }
        });

        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Minify JSON files
        console.log('\nMinifying JSON files...');
        await minifyJsonFiles();

        // Remove svg files
        console.log('\nRemoving SVG files...');
        fs.rmSync(path.join(outputDir, 'svg'), { recursive: true, force: true });

        console.log('\nAll directories processed successfully!');
    } catch (error) {
        console.error('Error in main process:', error);
    }
}

// Run the main function
main();