import { logger } from '@/logger/logger';

type ImageData = {
  url: string;
  name: string;
};

const scrapeData = async (documentUrl: string): Promise<ImageData[]> => {
  try {
    const manifestUrl = documentUrl.replace(
      'https://gallica.bnf.fr/',
      'https://gallica.bnf.fr/services/ajax/pagination/SINGLE/',
    );

    const manifest = await fetch(manifestUrl).then((res) => res.json());
    logger.info(`Fetched manifest from ${manifestUrl}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = manifest.fragment.contenu.map((item: any) => {
      const { url } = item;
      const downloadUrl =
        url.replace(
          'https://gallica.bnf.fr/services/ajax/pagination/page/SINGLE/',
          'https://gallica.bnf.fr/',
        ) + '/fundefined.jpeg?download=1';
      const name = `${item.contenu}_${crypto.randomUUID().slice(0, 7)}.jpeg`;

      return { url: downloadUrl, name };
    });

    return images;
  } catch (error) {
    logger.error(`Error fetching manifest for ${documentUrl}: ${error}`);
    return [];
  }
};

export { scrapeData };
