import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { OUTPUT_BASE_DIR } from '@/constants';
import type { LocalContext } from '@/context';
import { scrapeData } from '@/lib/scraper';
import { logger } from '@/logger/logger';

interface CommandFlags {
  outDir?: string;
  toPdf?: boolean;
}

export default async function (
  this: LocalContext,
  flags: CommandFlags,
  ...documentUrls: string[]
): Promise<void> {
  for (const documentUrl of documentUrls) {
    const documentNameUrl = documentUrl.replace(
      'https://gallica.bnf.fr/',
      'https://gallica.bnf.fr/services/getSyntheseContent/',
    );

    let documentName = documentUrl.split('/').pop() || 'document';

    try {
      const response = await fetch(documentNameUrl);
      const data = await response.json();
      documentName =
        data.fragment.parameters.gallicarte.title.replaceAll('/', '_') ||
        documentName;
      logger.info(`Fetched document name: ${documentName}`);
    } catch {
      logger.warn(
        `Could not fetch document name from ${documentNameUrl}, using default name: ${documentName}`,
      );
    }

    const outDir = flags.outDir || `${OUTPUT_BASE_DIR}/${documentName}`;

    const images = await scrapeData(documentUrl);

    for (const [index, imageData] of images.entries()) {
      logger.info(
        `Downloading image ${index + 1}/${images.length}: ${imageData.url}`,
      );

      try {
        const response = await fetch(imageData.url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = imageData.name;
        await mkdir(outDir, { recursive: true });
        let filePath = `${outDir}/${filename}`;

        if (existsSync(filePath)) {
          logger.info(`File already exists at ${filePath}, skipping download.`);
        }

        await writeFile(filePath, buffer);
        logger.info(`Saved image to ${filePath}`);
      } catch (error) {
        logger.error(
          `Error downloading or saving image url ${imageData.url}: ${error}`,
        );
      }
    }

    if (flags.toPdf) {
      logger.info('Converting images to PDF...');

      const pdfDoc = await PDFDocument.create();

      for (const [index, imageData] of images.entries()) {
        logger.info(`Adding image ${index + 1}/${images.length} to PDF`);

        const imageFilePath = `${outDir}/${imageData.name}`;
        const imageBytes = await readFile(imageFilePath);

        let image;
        if (imageData.name.toLowerCase().endsWith('.png')) {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          image = await pdfDoc.embedJpg(imageBytes);
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfPath = `${outDir}/${documentName}.pdf`;
      await writeFile(pdfPath, pdfBytes);
      logger.info(`PDF saved to ${pdfPath}`);
    }
  }
}
