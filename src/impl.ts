import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { delay, retry } from 'es-toolkit';
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
  const processDocument = async (documentUrl: string): Promise<void> => {
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

    const outDir = `${flags.outDir || OUTPUT_BASE_DIR}/${documentName}`;

    const { images } = await scrapeData(documentUrl);

    await mkdir(outDir, { recursive: true });

    for (const [index, imageData] of images.entries()) {
      logger.info(
        `Downloading image ${index + 1}/${images.length}: ${imageData.url}`,
      );

      try {
        const response = await retry(async () => {
          await delay(5000);
          const response = await fetch(imageData.url);
          if (!response.ok) throw new Error(response.statusText);
          return response;
        }, 100);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = imageData.name;
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
  };

  const results = await Promise.allSettled(
    documentUrls.map((documentUrl) => processDocument(documentUrl)),
  );

  const failedDocuments = results
    .map((result, index) => ({ result, documentUrl: documentUrls[index] }))
    .filter(({ result }) => result.status === 'rejected');

  if (failedDocuments.length > 0) {
    for (const { result, documentUrl } of failedDocuments) {
      logger.error(
        `Failed to process ${documentUrl}: ${(result as PromiseRejectedResult).reason}`,
      );
    }

    throw new Error(
      `Failed to process ${failedDocuments.length}/${documentUrls.length} documents`,
    );
  }
}
