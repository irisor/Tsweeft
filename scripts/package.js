import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// First, let's create a zip file
const output = fs.createWriteStream(path.join(__dirname, '../extension.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
  console.log('Extension has been packaged successfully!');
  console.log(`Total bytes: ${archive.pointer()}`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add the specific files and directories we want
archive.file('manifest.json', { name: 'manifest.json' });
archive.directory('dist/', 'dist');
archive.directory('public/', 'public');

archive.finalize();
