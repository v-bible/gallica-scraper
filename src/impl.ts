import { existsSync } from 'fs';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { delay, retry } from 'es-toolkit';
import { PDFDocument } from 'pdf-lib';
import {
  DEFAULT_IGNORE_COMPLETED,
  DEFAULT_OVERWRITE,
  DEFAULT_TO_PDF,
  DELAY_BETWEEN_REQUESTS_MS,
  MAX_RETRY_ATTEMPTS,
  OUTPUT_BASE_DIR,
} from '@/constants';
import type { LocalContext } from '@/context';
import { logger } from '@/logger/logger';

interface CommandFlags {
  outDir?: string;
  toPdf?: boolean;
  ignoreCompleted?: boolean;
  overwrite?: boolean;
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
  const outDirFlag = flags.outDir || OUTPUT_BASE_DIR;
  const toPdfFlag = flags.toPdf || DEFAULT_TO_PDF;
  const ignoreCompletedFlag = flags.ignoreCompleted || DEFAULT_IGNORE_COMPLETED;
  const overwriteFlag = flags.overwrite || DEFAULT_OVERWRITE;

  const currentBooks = await readdir(outDirFlag);

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
      const existBook = currentBooks.find((book) =>
        book.includes(documentName),
      );

      if (existBook) {
        documentName = existBook;

        logger.info(
          `Document folder ${existBook} already exists in ${outDirFlag}, using existing name.`,
        );
      } else {
        const response = await retry(async () => {
          const response = await fetch(documentNameUrl);
          if (!response.ok) {
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            throw new Error(response.statusText);
          }
          return response;
        }, MAX_RETRY_ATTEMPTS);
        const data = await response.json();
        documentName = `[${documentName}]_(${data.fragment.parameters.gallicarte.title.replaceAll('/', '_').replaceAll(' | Gallica', '')})`;

        logger.info(`Fetched document name: ${documentName}`);
      }
    } catch (error) {
      errors.push(`document-name: ${getErrorMessage(error)}`);
      logger.warn(
        `Could not fetch document name from ${documentNameUrl}, using default name: ${documentName}`,
      );
    }

    const documentOutputPath = `${outDirFlag}/${documentName}`;
    const pdfPath = `${documentOutputPath}/${documentName}.pdf`;

    await mkdir(documentOutputPath, { recursive: true });

    // Skip if PDF already exists
    if (ignoreCompletedFlag && toPdfFlag && existsSync(pdfPath)) {
      logger.info(`PDF already exists at ${pdfPath}, skipping document.`);
      return {
        documentUrl,
        documentName,
        errors,
      };
    }

    let images: { url: string; name: string }[] = [];
    try {
      let manifest = null;

      if (existsSync(`${documentOutputPath}/manifest.json`)) {
        const manifestContent = await readFile(
          `${documentOutputPath}/manifest.json`,
          'utf-8',
        );
        manifest = JSON.parse(manifestContent);
        logger.info(
          `Loaded existing manifest from ${documentOutputPath}/manifest.json`,
        );
      } else {
        const manifestUrl = documentUrl.replace(
          'https://gallica.bnf.fr/',
          'https://gallica.bnf.fr/services/ajax/pagination/SINGLE/',
        );

        manifest = await retry(async () => {
          const response = await fetch(manifestUrl);
          if (!response.ok) {
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }
          return response.json();
        }, MAX_RETRY_ATTEMPTS);

        logger.info(`Fetched manifest from ${manifestUrl}`);

        await writeFile(
          `${documentOutputPath}/manifest.json`,
          JSON.stringify(manifest, null, 2),
          'utf-8',
        );
      }

      images = (manifest?.fragment?.contenu ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any, idx: number) => {
          const { url } = item;
          const downloadUrl = url
            .replace(
              'https://gallica.bnf.fr/services/ajax/pagination/page/SINGLE/',
              'https://gallica.bnf.fr/',
            )
            .replace('.image', '.highres');
          const name = `[${idx + 1}]_${item.contenu}.jpeg`;

          return { url: downloadUrl, name };
        },
      );
    } catch (error) {
      errors.push(`manifest: ${getErrorMessage(error)}`);

      return {
        documentUrl,
        documentName,
        errors,
      };
    }

    const currentFiles = await readdir(documentOutputPath);

    for (const [index, imageData] of images.entries()) {
      const fileExists = currentFiles.includes(imageData.name);
      if (fileExists && !overwriteFlag) {
        logger.info(
          `File ${imageData.name} already exists in ${documentOutputPath}, skipping download.`,
        );

        continue;
      }

      logger.info(
        `Downloading image ${index + 1}/${images.length}: ${imageData.url}`,
      );

      try {
        const filename = imageData.name;
        const filePath = `${documentOutputPath}/${filename}`;

        const response = await retry(async () => {
          const response = await fetch(imageData.url);
          if (!response.ok) {
            await delay(DELAY_BETWEEN_REQUESTS_MS);
            throw new Error(response.statusText);
          }
          return response;
        }, MAX_RETRY_ATTEMPTS);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await writeFile(filePath, buffer);
        logger.info(`Saved image to ${filePath}`);
      } catch (error) {
        errors.push(`image: ${getErrorMessage(error)}`);
        logger.error(
          `Error downloading or saving image url ${imageData.url}: ${error}`,
        );
      }
    }

    if (toPdfFlag) {
      logger.info('Converting images to PDF...');

      const pdfDoc = await PDFDocument.create();

      for (const [index, imageData] of images.entries()) {
        logger.info(`Adding image ${index + 1}/${images.length} to PDF`);

        const imageFilePath = `${documentOutputPath}/${imageData.name}`;
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
      const pdfPath = `${documentOutputPath}/${documentName}.pdf`;
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

  let results: DocumentResult[] = [];
  for (const documentUrl of documentUrls) {
    const result = await processDocument(documentUrl);
    results.push(result);
  }

  const failedDocuments = results.filter((result) => result.errors.length > 0);

  const reportPath = `${outDirFlag}/crawl-report.json`;
  await mkdir(outDirFlag, { recursive: true });
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
