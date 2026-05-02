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

interface DocumentResult {
  documentUrl: string;
  documentName: string;
  errors: string[];
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export default async function (
  this: LocalContext,
  flags: CommandFlags,
  ...documentUrls: string[]
): Promise<void> {
  const processDocument = async (
    documentUrl: string,
  ): Promise<DocumentResult> => {
    const documentNameUrl = documentUrl.replace(
      'https://gallica.bnf.fr/',
      'https://gallica.bnf.fr/services/getSyntheseContent/',
    );

    let documentName = documentUrl.split('/').pop() || 'document';
    const errors: string[] = [];

    try {
      const response = await retry(async () => {
        await delay(5000);
        const response = await fetch(documentNameUrl);
        if (!response.ok) throw new Error(response.statusText);
        return response;
      }, 300);
      const data = await response.json();
      documentName =
        data.fragment.parameters.gallicarte.title.replaceAll('/', '_') ||
        documentName;

      logger.info(`Fetched document name: ${documentName}`);
    } catch (error) {
      errors.push(`document-name: ${getErrorMessage(error)}`);
      logger.warn(
        `Could not fetch document name from ${documentNameUrl}, using default name: ${documentName}`,
      );
    }

    const outDir = `${flags.outDir || OUTPUT_BASE_DIR}/${documentName}`;

    let images: { url: string; name: string }[] = [];
    try {
      ({ images } = await scrapeData(documentUrl));
    } catch (error) {
      errors.push(`manifest: ${getErrorMessage(error)}`);

      return {
        documentUrl,
        documentName,
        errors,
      };
    }

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
        }, 300);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const filename = imageData.name;
        const filePath = `${outDir}/${filename}`;

        if (existsSync(filePath)) {
          logger.info(`File already exists at ${filePath}, skipping download.`);
          continue;
        }

        await writeFile(filePath, buffer);
        logger.info(`Saved image to ${filePath}`);
      } catch (error) {
        errors.push(`image: ${getErrorMessage(error)}`);
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
      try {
        await writeFile(pdfPath, pdfBytes);
        logger.info(`PDF saved to ${pdfPath}`);
      } catch (error) {
        errors.push(`pdf: ${getErrorMessage(error)}`);
      }
    }

    return {
      documentUrl,
      documentName,
      errors,
    };
  };

  const results = await Promise.all(
    documentUrls.map((documentUrl) => processDocument(documentUrl)),
  );

  const failedDocuments = results.filter((result) => result.errors.length > 0);

  const reportPath = `${flags.outDir || OUTPUT_BASE_DIR}/crawl-report.json`;
  await mkdir(flags.outDir || OUTPUT_BASE_DIR, { recursive: true });
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalDocuments: results.length,
        failedDocuments: failedDocuments.length,
        documents: results,
      },
      null,
      2,
    ),
    'utf-8',
  );
  logger.info(`Crawl report saved to ${reportPath}`);

  if (failedDocuments.length > 0) {
    for (const failed of failedDocuments) {
      logger.error(
        `Failed ${failed.documentUrl}: ${failed.errors.join(' | ')}`,
      );
    }

    throw new Error(
      `Failed to process ${failedDocuments.length}/${documentUrls.length} documents`,
    );
  }
}
