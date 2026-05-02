import { retry } from 'es-toolkit';
import { logger } from '@/logger/logger';

type ImageData = {
  url: string;
  name: string;
};

const scrapeData = async (
  documentUrl: string,
): Promise<{ images: ImageData[] }> => {
  const manifestUrl = documentUrl.replace(
    'https://gallica.bnf.fr/',
    'https://gallica.bnf.fr/services/ajax/pagination/SINGLE/',
  );

  try {
    const manifest = await retry(async () => {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response.json();
    }, 3);

    logger.info(`Fetched manifest from ${manifestUrl}`);

    const images = (manifest?.fragment?.contenu ?? []).map(
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

    return { images };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Manifest fetch failed: ${manifestUrl} - ${message}`);
  }
};

export { scrapeData };
