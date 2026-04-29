import { logger } from '@/logger/logger';

type ImageData = {
  url: string;
  name: string;
};

const scrapeData = async (
  documentUrl: string,
): Promise<{ images: ImageData[] }> => {
  try {
    const manifestUrl = documentUrl.replace(
      'https://gallica.bnf.fr/',
      'https://gallica.bnf.fr/services/ajax/pagination/SINGLE/',
    );

    const manifest = await fetch(manifestUrl).then((res) => res.json());
    logger.info(`Fetched manifest from ${manifestUrl}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = manifest.fragment.contenu.map((item: any, idx: number) => {
      const { url } = item;
      const downloadUrl = url
        .replace(
          'https://gallica.bnf.fr/services/ajax/pagination/page/SINGLE/',
          'https://gallica.bnf.fr/',
        )
        .replace('.image', '.highres');
      const name = `[${idx + 1}]_${item.contenu}.jpeg`;

      return { url: downloadUrl, name };
    });

    return { images };
  } catch (error) {
    logger.error(`Error fetching manifest for ${documentUrl}: ${error}`);
    return { images: [] };
  }
};

export { scrapeData };
